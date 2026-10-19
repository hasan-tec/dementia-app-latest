/**
 * Tour Step Definitions
 * Defines the anchored step hierarchy, instruction text, and target selectors.
 */

export interface TourStep {
  id: string;
  stepNumber: number;
  targetSelector: string; // [data-tour="..."]
  title: string;
  instruction: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
  targetPath?: string; // Expected route
  autoAdvanceEvent?: string; // Event that triggers progression
}

export const MAIN_TOUR_STEPS: TourStep[] = [
  {
    id: 'step-nav-people',
    stepNumber: 1,
    targetSelector: '[data-tour="nav-people"]',
    title: 'Manage Registered People',
    instruction: 'Click "People" in the sidebar to view your registered family members and friends.',
    placement: 'right',
    targetPath: '/',
  },
  {
    id: 'step-people-add',
    stepNumber: 2,
    targetSelector: '[data-tour="people-add"]',
    title: 'Add a Loved One',
    instruction: 'Click "+ Add Person" to enroll someone new for facial recognition.',
    placement: 'bottom',
    targetPath: '/people',
  },
  {
    id: 'step-person-photo',
    stepNumber: 3,
    targetSelector: '[data-tour="person-photo"]',
    title: 'Select a Face Photo',
    instruction: 'Upload a clear, front-facing photo containing exactly one person in good lighting.',
    placement: 'top',
  },
  {
    id: 'step-person-name',
    stepNumber: 4,
    targetSelector: '[data-tour="person-name"]',
    title: 'Enter Name',
    instruction: 'Type the person\'s name (e.g., "Sarah").',
    placement: 'top',
  },
  {
    id: 'step-person-relation',
    stepNumber: 5,
    targetSelector: '[data-tour="person-relation"]',
    title: 'Define Relationship',
    instruction: 'Specify their relationship to the patient (e.g., "Daughter", "Grandson").',
    placement: 'top',
  },
  {
    id: 'step-person-save',
    stepNumber: 6,
    targetSelector: '[data-tour="person-save"]',
    title: 'Save Enrollment',
    instruction: 'Once the green checkmark confirms face extraction, click "Add Person" to save.',
    placement: 'top',
    autoAdvanceEvent: 'person:save-success',
  },
  {
    id: 'step-person-view',
    stepNumber: 7,
    targetSelector: '[data-tour="person-view"]',
    title: 'View Person Profile',
    instruction: 'Click on the newly registered card to view their details and conversation history.',
    placement: 'bottom',
    targetPath: '/people',
  },
  {
    id: 'step-conversation-add',
    stepNumber: 8,
    targetSelector: '[data-tour="conversation-add"]',
    title: 'Log Recent Conversation',
    instruction: 'Click "+ Add Conversation" to record memories and recent interactions.',
    placement: 'bottom',
  },
  {
    id: 'step-conversation-text',
    stepNumber: 9,
    targetSelector: '[data-tour="conversation-text"]',
    title: 'Enter Notes',
    instruction: 'Type notes from your conversation (e.g. "We talked about planting roses in the garden").',
    placement: 'top',
  },
  {
    id: 'step-conversation-save',
    stepNumber: 10,
    targetSelector: '[data-tour="conversation-save"]',
    title: 'Save Conversation',
    instruction: 'Click "Save Conversation" to generate a memory anchor summary.',
    placement: 'top',
    autoAdvanceEvent: 'conversation:save-success',
  },
  {
    id: 'step-nav-ar',
    stepNumber: 11,
    targetSelector: '[data-tour="nav-ar"]',
    title: 'Launch AR Viewer',
    instruction: 'Click "AR Viewer" to launch real-time camera face recognition.',
    placement: 'right',
  },
  {
    id: 'step-ar-status',
    stepNumber: 12,
    targetSelector: '[data-tour="ar-status"]',
    title: 'Recognition Status Badge',
    instruction: 'This badge shows when AI models are scanning, analyzing, or have recognized a face.',
    placement: 'bottom',
    targetPath: '/ar',
  },
  {
    id: 'step-ar-camera-toggle',
    stepNumber: 13,
    targetSelector: '[data-tour="ar-camera-toggle"]',
    title: 'Camera & Privacy Controls',
    instruction: 'You can pause and resume the camera anytime using this button.',
    placement: 'top',
    targetPath: '/ar',
  },
  {
    id: 'step-ar-home',
    stepNumber: 14,
    targetSelector: '[data-tour="ar-home"]',
    title: 'Return to Portal',
    instruction: 'Click "N" anytime to exit AR mode and return to your dashboard.',
    placement: 'top',
    targetPath: '/ar',
  },
  {
    id: 'step-help-replay',
    stepNumber: 15,
    targetSelector: '[data-tour="nav-help"]',
    title: 'Help & Replay Guide',
    instruction: 'You can replay this tutorial anytime from the Help section. You are all set!',
    placement: 'right',
  },
];
