
import { API_BASE_URL } from '@/lib/constants'
import {
  getAdminActions,
  executeAdminAction,
} from '@/api/actions'

const API_ROOT = API_BASE_URL.replace(/\/+$/, '')

async function parse<T>(response: Response): Promise<T> {
  let body: any = null

  try {
    body = await response.json()
  } catch {
    // Preserve the HTTP status when the response is not JSON.
  }

  if (!response.ok) {
    const detail =
      body && typeof body.detail === 'string'
        ? body.detail
        : `API request failed (HTTP ${response.status})`

    throw new Error(detail)
  }

  return body as T
}

export async function analyzeDeepfakeImage(file: File) {
  const body = new FormData()
  body.append('file', file)

  return parse<any>(
    await fetch(`${API_ROOT}/analyze/image`, {
      method: 'POST',
      body,
    }),
  )
}

/** Reuse the existing, registered Admin Action API. */
export async function getDeepfakeActions(requestId: string) {
  return getAdminActions(requestId)
}

/** Execute an action through the shared backend action service. */
export async function executeDeepfakeAction(
  requestId: string,
  actionId: string,
  approved: boolean,
  note = '',
) {
  return executeAdminAction({
    request_id: requestId,
    action_id: actionId,
    approved,
    note,
    actor: 'SOC Analyst',
  })
}
