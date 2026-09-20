import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface HealthStatus {
  agents: Record<string, AgentStatus>;
  services: Record<string, ServiceStatus>;
  timestamp: number;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  lastSeen?: number;
  error?: string;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  port?: number;
  error?: string;
}

export async function healthCheck(): Promise<HealthStatus> {
  const timestamp = Date.now();
  const agents: Record<string, AgentStatus> = {};
  const services: Record<string, ServiceStatus> = {};
  
  // Check RT bus
  try {
    await fetch('http://localhost:18889/status');
    services.rtBus = { name: 'RT Bus', status: 'healthy', port: 18889 };
  } catch (error) {
    services.rtBus = { name: 'RT Bus', status: 'unhealthy', port: 18889, error: String(error) };
  }
  
  // Check iris-lead
  try {
    await fetch('http://localhost:5010/health');
    services.crewLead = { name: 'Iris Lead', status: 'healthy', port: 5010 };
  } catch (error) {
    services.crewLead = { name: 'Iris Lead', status: 'unhealthy', port: 5010, error: String(error) };
  }
  
  // Check dashboard
  try {
    await fetch('http://localhost:4319/health');
    services.dashboard = { name: 'Dashboard', status: 'healthy', port: 4319 };
  } catch (error) {
    services.dashboard = { name: 'Dashboard', status: 'unhealthy', port: 4319, error: String(error) };
  }
  
  // Check MCP server
  try {
    await fetch('http://localhost:5020/health');
    services.mcpServer = { name: 'MCP Server', status: 'healthy', port: 5020 };
  } catch (error) {
    services.mcpServer = { name: 'MCP Server', status: 'unhealthy', port: 5020, error: String(error) };
  }
  
  // Check agent processes
  const agentProcesses = [
    { id: 'iris-main', name: 'iris-main', pattern: 'gateway-bridge.*iris-main' },
    { id: 'iris-coder', name: 'iris-coder', pattern: 'gateway-bridge.*iris-coder' },
    { id: 'iris-pm', name: 'iris-pm', pattern: 'gateway-bridge.*iris-pm' },
    { id: 'iris-qa', name: 'iris-qa', pattern: 'gateway-bridge.*iris-qa' },
    { id: 'iris-fixer', name: 'iris-fixer', pattern: 'gateway-bridge.*iris-fixer' },
    { id: 'iris-security', name: 'iris-security', pattern: 'gateway-bridge.*iris-security' },
    { id: 'iris-coder-front', name: 'iris-coder-front', pattern: 'gateway-bridge.*iris-coder-front' },
    { id: 'iris-coder-back', name: 'iris-coder-back', pattern: 'gateway-bridge.*iris-coder-back' },
    { id: 'iris-github', name: 'iris-github', pattern: 'gateway-bridge.*iris-github' },
    { id: 'iris-frontend', name: 'iris-frontend', pattern: 'gateway-bridge.*iris-frontend' },
    { id: 'iris-copywriter', name: 'iris-copywriter', pattern: 'gateway-bridge.*iris-copywriter' },
    { id: 'iris-telegram', name: 'iris-telegram', pattern: 'gateway-bridge.*iris-telegram' },
    { id: 'iris-orchestrator', name: 'iris-orchestrator', pattern: 'gateway-bridge.*iris-orchestrator' },
    { id: 'iris-seo', name: 'iris-seo', pattern: 'gateway-bridge.*iris-seo' },
    { id: 'iris-researcher', name: 'iris-researcher', pattern: 'gateway-bridge.*iris-researcher' },
    { id: 'iris-architect', name: 'iris-architect', pattern: 'gateway-bridge.*iris-architect' },
    { id: 'iris-whatsapp', name: 'iris-whatsapp', pattern: 'gateway-bridge.*iris-whatsapp' },
    { id: 'iris-ml', name: 'iris-ml', pattern: 'gateway-bridge.*iris-ml' }
  ];
  
  for (const agent of agentProcesses) {
    try {
      const { stdout } = await execAsync(`ps aux | grep "${agent.pattern}" | grep -v grep`);
      if (stdout.trim()) {
        agents[agent.id] = { 
          id: agent.id, 
          name: agent.name, 
          status: 'online',
          lastSeen: timestamp
        };
      } else {
        agents[agent.id] = { 
          id: agent.id, 
          name: agent.name, 
          status: 'offline'
        };
      }
    } catch (error) {
      agents[agent.id] = { 
        id: agent.id, 
        name: agent.name, 
        status: 'error',
        error: String(error)
      };
    }
  }
  
  return { agents, services, timestamp };
}
