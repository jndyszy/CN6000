const API_BASE = ''

// 上传接口使用 multipart/form-data，不能用通用 request 封装
export const uploadImage = async (file: File): Promise<string> => {
  const token = localStorage.getItem('token')
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '上传失败')
  return data.url as string
}
