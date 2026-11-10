// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProviderIncidentRegistry} from "../src/ProviderIncidentRegistry.sol";

contract ProviderIncidentRegistryTest is Test {
  ProviderIncidentRegistry internal registry;

  address internal admin = makeAddr("admin");
  address internal operator = makeAddr("operator");
  address internal attestor = makeAddr("attestor");
  address internal outsider = makeAddr("outsider");

  bytes32 internal constant PROVIDER_ID = keccak256("akash-provider-1");
  bytes32 internal constant NETWORK_ID = keccak256("akash-mainnet");
  bytes32 internal constant INCIDENT_ID = keccak256("incident-1");
  bytes32 internal constant SUMMARY = keccak256("provider offline");
  bytes32 internal constant EVIDENCE = keccak256("evidence-package");
  bytes32 internal constant REMEDIATION = keccak256("remediation-package");

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

  function setUp() public {
    vm.prank(admin);
    registry = new ProviderIncidentRegistry();

    vm.startPrank(admin);
    registry.grantRole(registry.PROVIDER_OPERATOR_ROLE(), operator);
    registry.grantRole(registry.INCIDENT_ATTESTOR_ROLE(), attestor);
    vm.stopPrank();
  }

  function _registerProvider() internal {
    vm.prank(operator);
    registry.registerProvider(PROVIDER_ID, NETWORK_ID, operator);
  }

  function _commitIncident() internal {
    _registerProvider();
    vm.prank(attestor);
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);
  }

  function _acknowledgeIncident() internal {
    _commitIncident();
    vm.prank(attestor);
    registry.acknowledgeIncident(INCIDENT_ID);
  }

  // ---------------------------------------------------------------------------
  // Roles
  // ---------------------------------------------------------------------------

  function testAdminReceivesDefaultAdminRole() public view {
    assertTrue(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin));
  }

  function testOnlyAdminCanGrantRoles() public {
    bytes32 role = registry.PROVIDER_OPERATOR_ROLE();
    vm.prank(outsider);
    vm.expectRevert();
    registry.grantRole(role, outsider);
  }

  function testRoleConstantsMatchDocumentedNames() public view {
    assertEq(registry.PROVIDER_OPERATOR_ROLE(), keccak256("PROVIDER_OPERATOR_ROLE"));
    assertEq(registry.INCIDENT_ATTESTOR_ROLE(), keccak256("INCIDENT_ATTESTOR_ROLE"));
    assertEq(registry.DEFAULT_ADMIN_ROLE(), bytes32(0));
  }

  // ---------------------------------------------------------------------------
  // Provider registration
  // ---------------------------------------------------------------------------

  function testRegisterProvider() public {
    vm.expectEmit(true, true, true, true);
    emit ProviderRegistered(PROVIDER_ID, operator, NETWORK_ID);

    vm.prank(operator);
    registry.registerProvider(PROVIDER_ID, NETWORK_ID, operator);

    ProviderIncidentRegistry.ProviderReference memory providerRef =
      registry.getProvider(PROVIDER_ID);
    assertEq(providerRef.providerId, PROVIDER_ID);
    assertEq(providerRef.operator, operator);
    assertEq(providerRef.networkId, NETWORK_ID);
    assertTrue(providerRef.active);
  }

  function testRegisterProviderRejectsZeroOperator() public {
    vm.prank(operator);
    vm.expectRevert(ProviderIncidentRegistry.ZeroOperator.selector);
    registry.registerProvider(PROVIDER_ID, NETWORK_ID, address(0));
  }

  function testRegisterProviderRejectsZeroProviderId() public {
    vm.prank(operator);
    vm.expectRevert(ProviderIncidentRegistry.ZeroProviderId.selector);
    registry.registerProvider(bytes32(0), NETWORK_ID, operator);
  }

  function testRegisterProviderRejectsZeroNetworkId() public {
    vm.prank(operator);
    vm.expectRevert(ProviderIncidentRegistry.ZeroNetworkId.selector);
    registry.registerProvider(PROVIDER_ID, bytes32(0), operator);
  }

  function testRegisterProviderRejectsDuplicateActiveProvider() public {
    _registerProvider();

    vm.prank(operator);
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.ProviderAlreadyActive.selector, PROVIDER_ID)
    );
    registry.registerProvider(PROVIDER_ID, NETWORK_ID, operator);
  }

  function testUnregisteredProviderCannotBeRead() public {
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.ProviderNotRegistered.selector, PROVIDER_ID)
    );
    registry.getProvider(PROVIDER_ID);
  }

  function testRegisterProviderRequiresOperatorRole() public {
    vm.prank(outsider);
    vm.expectRevert();
    registry.registerProvider(PROVIDER_ID, NETWORK_ID, outsider);
  }

  // ---------------------------------------------------------------------------
  // Incident commitment
  // ---------------------------------------------------------------------------

  function testSubmitIncidentCommitment() public {
    _registerProvider();

    vm.expectEmit(true, true, false, true);
    emit IncidentCommitted(
      INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE, attestor, uint64(block.timestamp)
    );

    vm.prank(attestor);
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);

    ProviderIncidentRegistry.Incident memory incident = registry.getIncident(INCIDENT_ID);
    assertEq(incident.incidentId, INCIDENT_ID);
    assertEq(incident.providerId, PROVIDER_ID);
    assertEq(incident.summaryDigest, SUMMARY);
    assertEq(incident.sourceCommitment, EVIDENCE);
    assertEq(incident.createdAt, uint64(block.timestamp));
    assertEq(uint256(incident.status), uint256(ProviderIncidentRegistry.IncidentStatus.Open));
  }

  function testSubmitIncidentRequiresRegisteredProvider() public {
    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.ProviderNotRegistered.selector, PROVIDER_ID)
    );
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);
  }

  function testSubmitIncidentRejectsZeroDigests() public {
    _registerProvider();

    vm.startPrank(attestor);
    vm.expectRevert(ProviderIncidentRegistry.ZeroSummaryDigest.selector);
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, bytes32(0), EVIDENCE);

    vm.expectRevert(ProviderIncidentRegistry.ZeroSourceCommitment.selector);
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, bytes32(0));
    vm.stopPrank();
  }

  function testSubmitIncidentRejectsDuplicateIncidentId() public {
    _commitIncident();

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.IncidentAlreadyExists.selector, INCIDENT_ID)
    );
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);
  }

  function testSubmitIncidentRequiresAttestorRole() public {
    _registerProvider();

    vm.prank(outsider);
    vm.expectRevert();
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);
  }

  // ---------------------------------------------------------------------------
  // Acknowledge
  // ---------------------------------------------------------------------------

  function testAcknowledgeOpenIncident() public {
    _commitIncident();

    vm.expectEmit(true, true, false, true);
    emit IncidentAcknowledged(INCIDENT_ID, attestor, uint64(block.timestamp));

    vm.prank(attestor);
    registry.acknowledgeIncident(INCIDENT_ID);

    assertEq(
      uint256(registry.getIncidentStatus(INCIDENT_ID)),
      uint256(ProviderIncidentRegistry.IncidentStatus.Acknowledged)
    );
  }

  function testAcknowledgeRequiresOpenStatus() public {
    _acknowledgeIncident();

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(
        ProviderIncidentRegistry.InvalidIncidentStatus.selector,
        INCIDENT_ID,
        ProviderIncidentRegistry.IncidentStatus.Acknowledged,
        ProviderIncidentRegistry.IncidentStatus.Open
      )
    );
    registry.acknowledgeIncident(INCIDENT_ID);
  }

  function testAcknowledgeUnknownIncidentReverts() public {
    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.IncidentNotFound.selector, INCIDENT_ID)
    );
    registry.acknowledgeIncident(INCIDENT_ID);
  }

  // ---------------------------------------------------------------------------
  // Remediation and close
  // ---------------------------------------------------------------------------

  function testSubmitRemediation() public {
    _acknowledgeIncident();

    vm.expectEmit(true, true, true, true);
    emit RemediationCommitted(INCIDENT_ID, REMEDIATION, attestor, uint64(block.timestamp));

    vm.prank(attestor);
    registry.submitRemediationCommitment(INCIDENT_ID, REMEDIATION);

    assertEq(registry.remediationCommitments(INCIDENT_ID), REMEDIATION);
    assertEq(
      uint256(registry.getIncidentStatus(INCIDENT_ID)),
      uint256(ProviderIncidentRegistry.IncidentStatus.RemediationSubmitted)
    );
  }

  function testRemediationRequiresAcknowledgedStatus() public {
    _commitIncident();

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(
        ProviderIncidentRegistry.InvalidIncidentStatus.selector,
        INCIDENT_ID,
        ProviderIncidentRegistry.IncidentStatus.Open,
        ProviderIncidentRegistry.IncidentStatus.Acknowledged
      )
    );
    registry.submitRemediationCommitment(INCIDENT_ID, REMEDIATION);
  }

  function testRemediationRejectsZeroDigest() public {
    _acknowledgeIncident();

    vm.prank(attestor);
    vm.expectRevert(ProviderIncidentRegistry.ZeroRemediationCommitment.selector);
    registry.submitRemediationCommitment(INCIDENT_ID, bytes32(0));
  }

  function testCloseAcknowledgedIncident() public {
    _acknowledgeIncident();

    vm.expectEmit(true, true, false, true);
    emit IncidentClosed(INCIDENT_ID, attestor, uint64(block.timestamp));

    vm.prank(attestor);
    registry.closeIncident(INCIDENT_ID);

    assertEq(
      uint256(registry.getIncidentStatus(INCIDENT_ID)),
      uint256(ProviderIncidentRegistry.IncidentStatus.Closed)
    );
  }

  function testCloseRemediatedIncident() public {
    _acknowledgeIncident();

    vm.startPrank(attestor);
    registry.submitRemediationCommitment(INCIDENT_ID, REMEDIATION);
    registry.closeIncident(INCIDENT_ID);
    vm.stopPrank();

    assertEq(
      uint256(registry.getIncidentStatus(INCIDENT_ID)),
      uint256(ProviderIncidentRegistry.IncidentStatus.Closed)
    );
  }

  function testCannotCloseOpenIncident() public {
    _commitIncident();

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(
        ProviderIncidentRegistry.InvalidIncidentStatus.selector,
        INCIDENT_ID,
        ProviderIncidentRegistry.IncidentStatus.Open,
        ProviderIncidentRegistry.IncidentStatus.Acknowledged
      )
    );
    registry.closeIncident(INCIDENT_ID);
  }

  function testClosedIncidentCannotBeReopened() public {
    _acknowledgeIncident();
    vm.prank(attestor);
    registry.closeIncident(INCIDENT_ID);

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.IncidentAlreadyExists.selector, INCIDENT_ID)
    );
    registry.submitIncidentCommitment(INCIDENT_ID, PROVIDER_ID, SUMMARY, EVIDENCE);
  }

  function testClosedIncidentCannotBeAcknowledgedAgain() public {
    _acknowledgeIncident();
    vm.prank(attestor);
    registry.closeIncident(INCIDENT_ID);

    vm.prank(attestor);
    vm.expectRevert(
      abi.encodeWithSelector(
        ProviderIncidentRegistry.InvalidIncidentStatus.selector,
        INCIDENT_ID,
        ProviderIncidentRegistry.IncidentStatus.Closed,
        ProviderIncidentRegistry.IncidentStatus.Open
      )
    );
    registry.acknowledgeIncident(INCIDENT_ID);
  }

  function testUnknownIncidentCannotBeRead() public {
    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.IncidentNotFound.selector, INCIDENT_ID)
    );
    registry.getIncident(INCIDENT_ID);

    vm.expectRevert(
      abi.encodeWithSelector(ProviderIncidentRegistry.IncidentNotFound.selector, INCIDENT_ID)
    );
    registry.getIncidentStatus(INCIDENT_ID);
  }

  // ---------------------------------------------------------------------------
  // Fuzz
  // ---------------------------------------------------------------------------

  function testFuzzProviderRegistration(
    bytes32 providerId,
    bytes32 networkId,
    address providerOperator
  ) public {
    vm.assume(providerId != bytes32(0));
    vm.assume(networkId != bytes32(0));
    vm.assume(providerOperator != address(0));

    vm.prank(operator);
    registry.registerProvider(providerId, networkId, providerOperator);

    ProviderIncidentRegistry.ProviderReference memory providerRef = registry.getProvider(providerId);
    assertEq(providerRef.providerId, providerId);
    assertEq(providerRef.networkId, networkId);
    assertEq(providerRef.operator, providerOperator);
    assertTrue(providerRef.active);
  }
}
