/**
 * Dashboard Components Export
 * @author GitHub Copilot
 * @description Centralized exports for all dashboard components
 */

// Legacy exports
export * from './dashboard-sidebar-content'
export { default as DashboardCard } from './dashboard-card'

// New modular dashboard components
export { DashboardLayoutWrapper } from './dashboard-layout-wrapper'
export { DashboardHeader } from './dashboard-header'
export { DynamicBreadcrumb } from './dynamic-breadcrumb'
export { DashboardActions } from './dashboard-actions'
export * from '../../types/dashboard'
export * from './utils'
