// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ProviderIncidentRegistry
/// @notice Minimal, role-controlled registry for signed incident announcements and remediation
///         references. ComputePulse keeps observations, response bodies and operator notes
///         off-chain; this contract stores only fixed-size commitments and lifecycle status.
/// @dev There are no tokens, slashing rules, penalties, escrow or on-chain metrics.
contract ProviderIncidentRegistry is AccessControl {
  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  bytes32 public constant PROVIDER_OPERATOR_ROLE = keccak256("PROVIDER_OPERATOR_ROLE");
  bytes32 public constant INCIDENT_ATTESTOR_ROLE = keccak256("INCIDENT_ATTESTOR_ROLE");

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------

  enum IncidentStatus {
    None,
    Open,
    Acknowledged,
    RemediationSubmitted,
    Closed
  }

  struct ProviderReference {
    bytes32 providerId;
    address operator;
    bytes32 networkId;
    bool active;
  }

  struct Incident {
    bytes32 incidentId;
    bytes32 providerId;
    bytes32 summaryDigest;
    bytes32 sourceCommitment;
    uint64 createdAt;
    IncidentStatus status;
  }

  // ---------------------------------------------------------------------------
  // Storage
  // ---------------------------------------------------------------------------

  mapping(bytes32 providerId => ProviderReference) private _providers;
  mapping(bytes32 incidentId => Incident) private _incidents;

  /// @notice Digest of the remediation evidence package for an incident.
  mapping(bytes32 incidentId => bytes32 remediationCommitment) public remediationCommitments;

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  event ProviderRegistered(
    bytes32 indexed providerId, address indexed operator, bytes32 indexed networkId
  );
  event IncidentCommitted(
    bytes32 indexed incidentId,
    bytes32 indexed providerId,
    bytes32 summaryDigest,
    bytes32 sourceCommitment,
    address indexed attestor,
    uint64 createdAt
  );
  event IncidentAcknowledged(
    bytes32 indexed incidentId, address indexed attestor, uint64 acknowledgedAt
  );
  event RemediationCommitted(
    bytes32 indexed incidentId,
    bytes32 indexed remediationCommitment,
    address indexed attestor,
    uint64 submittedAt
  );
  event IncidentClosed(bytes32 indexed incidentId, address indexed attestor, uint64 closedAt);

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  error ZeroProviderId();
  error ZeroNetworkId();
  error ZeroOperator();
  error ProviderAlreadyActive(bytes32 providerId);
  error ProviderNotRegistered(bytes32 providerId);
  error ZeroIncidentId();
  error ZeroSummaryDigest();
  error ZeroSourceCommitment();
  error ZeroRemediationCommitment();
  error IncidentAlreadyExists(bytes32 incidentId);
  error IncidentNotFound(bytes32 incidentId);
  error InvalidIncidentStatus(bytes32 incidentId, IncidentStatus current, IncidentStatus expected);

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  // ---------------------------------------------------------------------------
  // Provider references
  // ---------------------------------------------------------------------------

  /// @notice Registers a provider providerRef or refreshes an inactive one.
  /// @param providerId Off-chain provider identifier, hashed to bytes32.
  /// @param networkId Off-chain network identifier, hashed to bytes32.
  /// @param operator Operator address accountable for the providerRef. Must not be zero.
  function registerProvider(bytes32 providerId, bytes32 networkId, address operator)
    external
    onlyRole(PROVIDER_OPERATOR_ROLE)
  {
    if (providerId == bytes32(0)) revert ZeroProviderId();
    if (networkId == bytes32(0)) revert ZeroNetworkId();
    if (operator == address(0)) revert ZeroOperator();

    ProviderReference storage providerRef = _providers[providerId];
    if (providerRef.active) revert ProviderAlreadyActive(providerId);

    providerRef.providerId = providerId;
    providerRef.operator = operator;
    providerRef.networkId = networkId;
    providerRef.active = true;

    emit ProviderRegistered(providerId, operator, networkId);
  }

  // ---------------------------------------------------------------------------
  // Incident commitments
  // ---------------------------------------------------------------------------

  /// @notice Commits a new incident for a registered provider.
  /// @dev The caller must hold INCIDENT_ATTESTOR_ROLE. The summary and evidence remain off-chain.
  function submitIncidentCommitment(
    bytes32 incidentId,
    bytes32 providerId,
    bytes32 summaryDigest,
    bytes32 sourceCommitment
  ) external onlyRole(INCIDENT_ATTESTOR_ROLE) {
    if (incidentId == bytes32(0)) revert ZeroIncidentId();
    if (summaryDigest == bytes32(0)) revert ZeroSummaryDigest();
    if (sourceCommitment == bytes32(0)) revert ZeroSourceCommitment();
    if (!_providers[providerId].active) revert ProviderNotRegistered(providerId);
    if (_incidents[incidentId].status != IncidentStatus.None) {
      revert IncidentAlreadyExists(incidentId);
    }

    uint64 createdAt = uint64(block.timestamp);
    _incidents[incidentId] = Incident({
      incidentId: incidentId,
      providerId: providerId,
      summaryDigest: summaryDigest,
      sourceCommitment: sourceCommitment,
      createdAt: createdAt,
      status: IncidentStatus.Open
    });

    emit IncidentCommitted(
      incidentId, providerId, summaryDigest, sourceCommitment, msg.sender, createdAt
    );
  }

  /// @notice Acknowledges an open incident.
  function acknowledgeIncident(bytes32 incidentId) external onlyRole(INCIDENT_ATTESTOR_ROLE) {
    Incident storage incident = _requireIncident(incidentId);
    if (incident.status != IncidentStatus.Open) {
      revert InvalidIncidentStatus(incidentId, incident.status, IncidentStatus.Open);
    }

    incident.status = IncidentStatus.Acknowledged;
    emit IncidentAcknowledged(incidentId, msg.sender, uint64(block.timestamp));
  }

  /// @notice Commits a remediation digest for an acknowledged incident.
  /// @dev The remediation text is not published; only its fixed-size digest is stored.
  function submitRemediationCommitment(bytes32 incidentId, bytes32 remediationCommitment)
    external
    onlyRole(INCIDENT_ATTESTOR_ROLE)
  {
    if (remediationCommitment == bytes32(0)) revert ZeroRemediationCommitment();
    Incident storage incident = _requireIncident(incidentId);
    if (incident.status != IncidentStatus.Acknowledged) {
      revert InvalidIncidentStatus(incidentId, incident.status, IncidentStatus.Acknowledged);
    }

    remediationCommitments[incidentId] = remediationCommitment;
    incident.status = IncidentStatus.RemediationSubmitted;

    emit RemediationCommitted(
      incidentId, remediationCommitment, msg.sender, uint64(block.timestamp)
    );
  }

  /// @notice Closes an acknowledged or remediation-submitted incident.
  /// @dev A closed incident cannot be reopened or replaced with a new commitment.
  function closeIncident(bytes32 incidentId) external onlyRole(INCIDENT_ATTESTOR_ROLE) {
    Incident storage incident = _requireIncident(incidentId);
    if (
      incident.status != IncidentStatus.Acknowledged
        && incident.status != IncidentStatus.RemediationSubmitted
    ) {
      revert InvalidIncidentStatus(incidentId, incident.status, IncidentStatus.Acknowledged);
    }

    incident.status = IncidentStatus.Closed;
    emit IncidentClosed(incidentId, msg.sender, uint64(block.timestamp));
  }

  // ---------------------------------------------------------------------------
  // Views
  // ---------------------------------------------------------------------------

  /// @notice Returns the provider providerRef for a registered provider.
  function getProvider(bytes32 providerId) external view returns (ProviderReference memory) {
    ProviderReference memory providerRef = _providers[providerId];
    if (!providerRef.active) revert ProviderNotRegistered(providerId);
    return providerRef;
  }

  /// @notice Returns the complete incident struct.
  function getIncident(bytes32 incidentId) external view returns (Incident memory) {
    return _requireIncident(incidentId);
  }

  /// @notice Returns only the current status, for lightweight integrations.
  function getIncidentStatus(bytes32 incidentId) external view returns (IncidentStatus) {
    return _requireIncident(incidentId).status;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  function _requireIncident(bytes32 incidentId) private view returns (Incident storage incident) {
    incident = _incidents[incidentId];
    if (incident.status == IncidentStatus.None) revert IncidentNotFound(incidentId);
  }
}
