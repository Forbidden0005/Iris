/**
 * Domain-Aware Planning
 * 
 * Routes roadmap items to specialized PM agents based on domain detection.
 * Each PM agent has expertise in their domain (CLI, Frontend, Core, etc.)
 * 
 * Based on Cursor's research: For large codebases (100K+ lines) with distinct
 * subsystems, domain-specific planning significantly improves task quality.
 */

// Domain definitions for iris repo
export const DOMAINS = {
  'iris-cli': {
    pmAgent: 'iris-pm-cli',
    keywords: [
      'CLI', 'iris-cli', 'command line', 'terminal', 'iris exec', 'iris chat',
      'TypeScript', 'src/', 'iris-cli/', 'REPL', 'executor', 'orchestrator',
      'pipeline', 'unified', 'session manager', 'worker pool'
    ],
    description: 'CLI tool and command-line interfaces',
    subdirs: ['iris-cli/src', 'iris-cli/extensions']
  },
  
  'frontend': {
    pmAgent: 'iris-pm-frontend',
    keywords: [
      'dashboard', 'frontend', 'UI', 'UX', 'HTML', 'CSS', 'JavaScript',
      'Vite', 'React', 'component', 'index.html', 'app.js', 'styles.css',
      'apps/dashboard/', 'tabs/', 'chat', 'agents tab', 'settings', 'providers'
    ],
    description: 'Web dashboard and UI components',
    subdirs: ['apps/dashboard/src', 'apps/dashboard/public']
  },
  
  'core': {
    pmAgent: 'iris-pm-core',
    keywords: [
      'gateway-bridge', 'iris-lead', 'RT bus', 'orchestration', 'dispatch',
      'agent registry', 'lib/', 'engines/', 'memory/', 'telemetry',
      'real-time', 'WebSocket', 'message bus', 'coordinator'
    ],
    description: 'Core orchestration and agent runtime',
    subdirs: ['lib/', 'engines/']
  },
  
  'integrations': {
    pmAgent: 'iris-pm',
    keywords: [
      'Telegram', 'WhatsApp', 'MCP', 'skills', 'greptile', 'Polymarket',
      'bridge', 'grabloco-bot', 'bot', 'integration', 'external API'
    ],
    description: 'External integrations and bridges',
    subdirs: ['grabloco-bot/', 'scripts/']
  },
  
  'docs': {
    pmAgent: 'iris-pm',
    keywords: [
      'documentation', 'README', 'AGENTS.md', 'docs/', 'markdown',
      '.md', 'guide', 'tutorial', 'example'
    ],
    description: 'Documentation and guides',
    subdirs: ['docs/']
  }
};

/**
 * Detect which domain a roadmap item belongs to
 * @param {string} itemText - The roadmap item description
 * @returns {{ domain: string|null, pmAgent: string, confidence: number }}
 */
export function detectDomain(itemText) {
  const text = itemText.toLowerCase();
  const scores = {};
  
  // Score each domain based on keyword matches
  for (const [domainId, domain] of Object.entries(DOMAINS)) {
    let score = 0;
    for (const keyword of domain.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        // Longer keywords get higher weight
        score += keyword.length > 10 ? 3 : keyword.length > 5 ? 2 : 1;
      }
    }
    scores[domainId] = score;
  }
  
  // Find highest scoring domain
  const entries = Object.entries(scores);
  const [topDomain, topScore] = entries.reduce(
    (max, curr) => curr[1] > max[1] ? curr : max,
    ['', 0]
  );
  
  // Require minimum confidence (at least 2 keyword matches)
  if (topScore < 2) {
    return {
      domain: null,
      pmAgent: 'iris-pm', // Default PM
      confidence: 0
    };
  }
  
  const totalScore = entries.reduce((sum, [, score]) => sum + score, 0);
  const confidence = totalScore > 0 ? topScore / totalScore : 0;
  
  return {
    domain: topDomain,
    pmAgent: DOMAINS[topDomain].pmAgent,
    confidence
  };
}

/**
 * Build domain-specific context for PM agent
 * @param {string} domainId - The domain identifier
 * @param {string} itemText - The roadmap item
 * @returns {string} Additional context to inject into PM prompt
 */
export function buildDomainContext(domainId, itemText) {
  if (!domainId || !DOMAINS[domainId]) return '';
  
  const domain = DOMAINS[domainId];
  
  return `

# Domain: ${domain.description}

This task is in the **${domainId}** domain. You are the domain specialist PM.

## Domain scope
${domain.subdirs.map(d => `- ${d}`).join('\n')}

## Domain-specific guidance
${getDomainGuidance(domainId)}

When expanding this task, consider:
- What files in this domain will be affected?
- What domain-specific patterns should be followed?
- Are there existing files in this domain to reference?
- What domain-specific tests or validation are needed?
`;
}

function getDomainGuidance(domainId) {
  const guidance = {
    'iris-cli': `
- iris-cli uses TypeScript, lives in iris-cli/src/
- Main modules: executor, orchestrator, session manager, CLI commands
- Follow existing command patterns in src/cli/index.ts
- All new commands need help text and examples
- Tests go in iris-cli/test/
`,
    'frontend': `
- Frontend uses vanilla JS + Vite, lives in apps/dashboard/src/
- Main structure: app.js (logic), index.html (structure), styles.css (design)
- Components split into tabs/ folder
- All API calls go through core/api.js
- Build with: cd apps/dashboard && npm run build
`,
    'core': `
- Core orchestration in root *.mjs files and lib/ folder
- Gateway-bridge.mjs: agent daemon, tool execution
- Iris-lead.mjs: chat handler, dispatcher
- lib/ contains shared modules (agent registry, engines, memory)
- Follow existing patterns in lib/ for new modules
`,
    'integrations': `
- External bridges live in root (telegram-bridge.mjs, whatsapp-bridge.mjs)
- Skills live in ~/.iris/skills/
- MCP integration in scripts/mcp-server.mjs
- Follow bridge pattern: connect → handle → forward to iris-lead
`,
    'docs': `
- Markdown format, clear structure
- Code examples must be tested/working
- Update AGENTS.md for user-facing features
- Keep docs/ organized by topic
`
  };
  
  return guidance[domainId] || '- Follow existing patterns in the codebase';
}

/**
 * Log domain routing decision
 */
export function logDomainRouting(itemText, detection) {
  const { domain, pmAgent, confidence } = detection;
  
  if (domain) {
    console.log(`  🎯 Domain: ${domain} (confidence: ${(confidence * 100).toFixed(0)}%) → ${pmAgent}`);
  } else {
    console.log(`  🎯 Domain: general (no specific match) → ${pmAgent}`);
  }
}
