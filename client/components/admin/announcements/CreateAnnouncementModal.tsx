import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'phosphor-react';
import { CreateAnnouncementDocument } from '../../../@types/generated/graphql';
import { gqlMutateTyped } from '../../api';

interface CreateAnnouncementModalProps {
	onClose: () => void;
}

export default function CreateAnnouncementModal(props: CreateAnnouncementModalProps) {
	const { onClose } = props;
	const [formData, setFormData] = useState({
		title: '',
		content: '',
		category: 'INFO',
		priority: 0,
		imageUrl: '',
		isDraft: false
	});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			setLoading(true);
			setError('');
			await gqlMutateTyped(CreateAnnouncementDocument, {
				input: {
					...formData,
					priority: parseInt(formData.priority.toString())
				}
			});
			onClose();
		} catch (err) {
			console.error('Failed to create announcement:', err);
			setError('Duyuru oluşturulamadı');
		} finally {
			setLoading(false);
		}
	};

	const modal = (
		<div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60">
			<div className="bg-zinc-800 border border-zinc-700 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
				<div className="p-6 border-b border-zinc-700 flex justify-between items-center">
					<h2 className="text-xl font-bold">Yeni Duyuru Oluştur</h2>
					<button onClick={onClose} className="p-2 hover:bg-zinc-700 rounded">
						<X size={20} />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-160px)]">
					<div className="p-6 grid grid-cols-2 gap-6">
						{/* Left - Form */}
						<div className="space-y-4">
							<div>
								<label className="block text-sm font-medium mb-2">Başlık</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) => setFormData({ ...formData, title: e.target.value })}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
									required
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Kategori</label>
								<select
									value={formData.category}
									onChange={(e) => setFormData({ ...formData, category: e.target.value })}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
								>
									<option value="FEATURE">🎉 Yenilik</option>
									<option value="BUGFIX">🔧 Düzeltme</option>
									<option value="IMPORTANT">⚠️ Önemli</option>
									<option value="INFO">ℹ️ Bilgi</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Öncelik (0-10)</label>
								<input
									type="number"
									min="0"
									max="10"
									value={formData.priority}
									onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">Resim URL (Opsiyonel)</label>
								<input
									type="url"
									value={formData.imageUrl}
									onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
									placeholder="https://..."
								/>
							</div>

							<div>
								<label className="block text-sm font-medium mb-2">İçerik</label>
								<textarea
									value={formData.content}
									onChange={(e) => setFormData({ ...formData, content: e.target.value })}
									className="w-full px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg h-64 font-mono text-sm"
									required
									placeholder="Duyuru içeriğini yazın..."
								/>
							</div>

							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="isDraft"
									checked={formData.isDraft}
									onChange={(e) => setFormData({ ...formData, isDraft: e.target.checked })}
									className="w-4 h-4"
								/>
								<label htmlFor="isDraft" className="text-sm">Taslak olarak kaydet</label>
							</div>
						</div>

						{/* Right - Live Preview */}
						<div className="border border-zinc-700 rounded-lg p-4 bg-zinc-900">
							<h3 className="font-semibold mb-4">Önizleme</h3>
							<div className="prose prose-invert prose-sm max-w-none">
								<h4>{formData.title || 'Başlık'}</h4>
								{formData.imageUrl && (
									<img src={formData.imageUrl} alt="Preview" className="rounded-lg mb-4" />
								)}
								<div className="whitespace-pre-wrap">
									{formData.content || 'İçerik buraya gelecek'}
								</div>
							</div>
						</div>
					</div>
				</form>

				<div className="p-6 border-t border-zinc-700 flex justify-end gap-3">
					{error && <p className="text-red-400 text-sm mr-auto">{error}</p>}
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition"
					>
						İptal
					</button>
					<button
						onClick={handleSubmit}
						disabled={loading}
						className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
					>
						{loading ? 'Oluşturuluyor...' : formData.isDraft ? 'Taslak Kaydet' : 'Yayınla'}
					</button>
				</div>
			</div>
		</div>
	);

	return createPortal(modal, document.body);
}
