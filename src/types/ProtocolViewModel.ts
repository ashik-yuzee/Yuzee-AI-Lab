/**
 * Yuzee Protocol View Models and UI Types
 */

import {
  YuzeeResponseV13,
  YuzeeContentBlock,
  YuzeeInteraction,
  YuzeeService,
  YuzeeState,
  YuzeeFollowups,
} from '../protocol/v1.3/Yuzee_Response_Protocol_v1.3';

export interface ProtocolValidationResult {
  schemaValid: boolean;
  semanticValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TrustedServiceAction {
  actionId: string;
  title: string;
  description: string;
  category: 'RMO' | 'DIRECT_APPLICATION' | 'ADVISORY' | 'EXTERNAL';
  requiresConfirmation: boolean;
  handlerUrl?: string;
  enabled: boolean;
}

export interface ProtocolInfo {
  promptVersion: string;
  protocolVersion: string;
  promptHash: string;
  schemaHash: string;
  targetRuntime: string;
  trustedServicesCount: number;
}
