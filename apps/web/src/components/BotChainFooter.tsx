import { ArrowUpRight } from 'lucide-react';

export function BotChainMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'bot-footer bot-footer-app' : 'bot-footer'}>
      <a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer" aria-label="BOT Chain website">
        {/* Authentic BOT Chain mark, supplied as a public asset. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bot-chain.svg" alt="BOT Chain" />
      </a>
      <span className="built">Built on BOT Chain</span>
      <span className="links">
        <a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer">
          botchain.ai <ArrowUpRight size={9} style={{ display: 'inline' }} />
        </a>
        <a href="https://scan.botchain.ai/" target="_blank" rel="noreferrer">
          explorer <ArrowUpRight size={9} style={{ display: 'inline' }} />
        </a>
      </span>
    </div>
  );
}
