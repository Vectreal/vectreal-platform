/**
 * Dashboard Layout
 * @description Production-ready dashboard layout following Google engineering standards
 *
 * This layout has been refactored to follow clean code principles:
 * - Single Responsibility: Each component has a single, well-defined purpose
 * - DRY: Common logic extracted into reusable hooks and utilities
 * - Modular: Components are separated into logical modules
 * - Type Safety: Full TypeScript coverage with proper interfaces
 * - Performance: Memoized components to prevent unnecessary re-renders
 * - Maintainability: Clear component hierarchy and separation of concerns
 */

import { DashboardLayoutWrapper } from '../../components/dashboard'

/**
 * Main Dashboard Layout Component
 *
 * This component serves as the entry point for the dashboard layout.
 * All complex logic has been extracted into specialized components:
 *
 * - DashboardLayoutWrapper: Main layout structure with sidebar
 * - DynamicBreadcrumb: Smart breadcrumb navigation
 * - DashboardHeader: Dynamic header with title and actions
 * - Various breadcrumb components: Modular breadcrumb rendering
 * - Utility functions: Route parsing and validation logic
 * - Custom hooks: Business logic for dynamic content generation
 */
const DashboardLayout = () => {
	return <DashboardLayoutWrapper />
}

export default DashboardLayout
