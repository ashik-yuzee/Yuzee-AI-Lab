import type {TrustedServiceAction} from '../types/ProtocolViewModel';

/** Authoritative executable-action bindings. Product catalogue entries alone grant no capability. */
export const TRUSTED_SERVICE_ACTIONS: Record<string, TrustedServiceAction & { isConnectedInLab: boolean }> = {
  'rmo_explore_courses': {
    actionId: 'rmo_explore_courses',
    title: 'Explore Certified Courses',
    description: 'Browse accredited Australian university and VET pathway courses matching your career goal.',
    category: 'RMO',
    requiresConfirmation: false,
    enabled: true,
    isConnectedInLab: false, // In Token Lab, actions are simulation/reference only until connected to a real live service backend
  },
  'rmo_apply_job': {
    actionId: 'rmo_apply_job',
    title: 'Apply for Verified Job Role',
    description: 'Submit an application directly to verified industry employer partners.',
    category: 'RMO',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
  'rmo_book_counsellor': {
    actionId: 'rmo_book_counsellor',
    title: 'Book 1-on-1 Senior Counsellor Session',
    description: 'Connect with a certified human education and career advisor.',
    category: 'ADVISORY',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
  'direct_admission_start': {
    actionId: 'direct_admission_start',
    title: 'Initiate Direct Admission',
    description: 'Start structured intake and document verification for priority admission.',
    category: 'DIRECT_APPLICATION',
    requiresConfirmation: true,
    enabled: true,
    isConnectedInLab: false,
  },
};

