'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  batchId?: string
}

export default function DepotPage() {
  const router = useRouter()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)
    )
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ file, status: 'pending' as const })),
    ])
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles]
  )

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const uploadAll = async () => {
    if (!files.length) return
    setIsUploading(true)

    const formData = new FormData()
    files
      .filter((f) => f.status === 'pending')
      .forEach((f) => formData.append('files', f.file))

    setFiles((prev) =>
      prev.map((f) =>
        f.status === 'pending' ? { ...f, status: 'uploading' } : f
      )
    )

    try {
      const res = await fetch('/api/batches', { method: 'POST', body: formData })
      const json = await res.json()

      if (res.ok) {
        setFiles((prev) =>
          prev.map((f, i) => ({
            ...f,
            status: 'done',
            batchId: json.batches?.[i]?.batch_id,
          }))
        )
        // Redirige vers la file d'attente après 1.5s
        setTimeout(() => router.push('/file-attente'), 1500)
      } else {
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'error',
            error: json.error ?? 'Erreur inconnue',
          }))
        )
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'error', error: 'Erreur réseau' }))
      )
    } finally {
      setIsUploading(false)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Déposer des relevés</h1>

      {/* Zone de dépôt */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer',
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <Upload className="h-8 w-8 text-gray-400 mb-3" />
        <p className="text-sm font-medium text-gray-700">
          Glissez vos relevés ici ou cliquez pour sélectionner
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Photos (JPEG, PNG, WEBP) et PDF multipages acceptés
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          Un PDF de 30 pages est découpé en 30 relevés distincts
        </p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf"
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {/* Liste des fichiers */}
      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
          </p>
          {files.map((f, i) => (
            <div
              key={`${f.file.name}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-gray-700">{f.file.name}</p>
                <p className="text-xs text-gray-400">
                  {(f.file.size / 1024 / 1024).toFixed(1)} Mo
                </p>
              </div>
              {f.status === 'pending' && (
                <button
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {f.status === 'uploading' && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              )}
              {f.status === 'done' && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {f.status === 'error' && (
                <span className="text-xs text-red-600">{f.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={uploadAll}
          loading={isUploading}
          disabled={pendingCount === 0}
        >
          <Upload className="h-4 w-4" />
          Envoyer {pendingCount > 0 ? `${pendingCount} fichier${pendingCount > 1 ? 's' : ''}` : ''}
        </Button>
        {files.length > 0 && (
          <Button
            variant="secondary"
            onClick={() => setFiles([])}
            disabled={isUploading}
          >
            Tout supprimer
          </Button>
        )}
      </div>
    </div>
  )
}
