import { request } from './client'

export interface HealthResponse { status?: string; service?: string; version?: string; [key: string]: unknown }

export const getHealth = () => request<HealthResponse>('/health')
