import React, { useRef, useState } from 'react';
import { api } from '../api/client';

export default function FileDropzone({ assessmentId, evidenceDefId, onUploaded }) {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadFile(assessmentId, evidenceDefId, file);
      onUploaded?.(result);
    } catch (e) {
      alert(`アップロード失敗: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'drag-over' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files[0]); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
        onChange={e => upload(e.target.files[0])}
      />
      {uploading
        ? 'アップロード中...'
        : <><div>ここにファイルをドロップ</div><div style={{ fontSize: 11, marginTop: 4 }}>または クリックして選択（PDF・Excel・CSV・画像 最大20MB）</div></>
      }
    </div>
  );
}
