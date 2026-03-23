import React, {useState, useEffect, useCallback} from 'react';
import {Trash} from 'phosphor-react';
import {AdminTrainerAlternativesDocument, AdminDeleteTrainerAlternativeDocument} from '../../../@types/generated/graphql';
import {gqlQueryTyped, gqlMutateTyped} from '../../api';

interface AlternativeRow {
	id: string;
	category: string;
	subset: string;
	case_name: string;
	algorithm: string;
	original_input: string;
	user_id: string;
	created_at: string;
}

export default function AdminAlgorithms() {
	const [items, setItems] = useState<AlternativeRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [page, setPage] = useState(0);
	const [category, setCategory] = useState('');
	const pageSize = 25;

	const fetchData = useCallback(async () => {
		try {
			setLoading(true);
			const res = await gqlQueryTyped(AdminTrainerAlternativesDocument, {
				category: category || null,
				page,
				pageSize,
			}, {fetchPolicy: 'network-only'});
			const data = res.data?.adminTrainerAlternatives;
			if (data) {
				setItems(data.items as AlternativeRow[]);
				setTotal(data.total);
			}
		} catch (error) {
			console.error('Failed to fetch trainer alternatives:', error);
		} finally {
			setLoading(false);
		}
	}, [category, page]);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	const handleDelete = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation();
		if (!confirm('Bu algortimayi silmek istediginize emin misiniz?')) return;

		try {
			await gqlMutateTyped(AdminDeleteTrainerAlternativeDocument, {id});
			fetchData();
		} catch (error) {
			alert('Silme basarisiz oldu');
		}
	};

	const CATEGORIES = [
		'PLL', 'OLL', 'F2L', 'COLL', 'OLLCP', 'ZBLL',
		'WVLS', 'VHLS', '2-Look PLL', '2-Look OLL',
		'CMLL', 'OH-CMLL', '2-Look CMLL',
	];

	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="p-8 max-w-7xl mx-auto">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-white mb-2">Algoritma Havuzu</h1>
				<p className="text-gray-400">Kullanicilarin ekledigi global alternatif algoritmalar ({total} toplam)</p>
			</div>

			<div className="flex gap-4 mb-6 bg-[#1e1e24] p-2 rounded-xl border border-white/5 w-fit">
				<select
					value={category}
					onChange={(e) => {
						setCategory(e.target.value);
						setPage(0);
					}}
					className="px-4 py-2 bg-[#1e1e24] text-gray-300 focus:outline-none focus:text-white [&>option]:bg-[#1e1e24] [&>option]:text-gray-300"
				>
					<option value="">Tum kategoriler</option>
					{CATEGORIES.map((cat) => (
						<option key={cat} value={cat}>{cat}</option>
					))}
				</select>
			</div>

			<div className="bg-[#1e1e24] rounded-2xl border border-white/5 overflow-hidden shadow-xl">
				{loading ? (
					<div className="flex flex-col items-center justify-center py-20 text-gray-400">
						<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
						<p>Yukleniyor...</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left border-collapse">
							<thead>
								<tr className="bg-white/5 border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
									<th className="p-5 font-semibold">Kategori</th>
									<th className="p-5 font-semibold">Subset</th>
									<th className="p-5 font-semibold">Case</th>
									<th className="p-5 font-semibold">Algoritma</th>
									<th className="p-5 font-semibold">Tarih</th>
									<th className="p-5 font-semibold text-right">Islem</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/5">
								{items.length === 0 ? (
									<tr>
										<td colSpan={6} className="p-12 text-center text-gray-500">
											Henuz alternatif algoritma eklenmemis
										</td>
									</tr>
								) : (
									items.map((item) => (
										<tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
											<td className="p-5">
												<span className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/5">
													{item.category}
												</span>
											</td>
											<td className="p-5 text-gray-400 text-sm">{item.subset}</td>
											<td className="p-5 text-white font-medium">{item.case_name}</td>
											<td className="p-5">
												<code className="text-indigo-300 text-sm">{item.original_input}</code>
											</td>
											<td className="p-5 text-sm text-gray-400 font-mono">
												{new Date(item.created_at).toLocaleDateString('tr-TR')}
											</td>
											<td className="p-5">
												<div className="flex justify-end">
													<button
														onClick={(e) => handleDelete(e, item.id)}
														className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition border border-red-500/20 opacity-0 group-hover:opacity-100"
														title="Sil"
													>
														<Trash size={18} />
													</button>
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				)}

				{totalPages > 1 && (
					<div className="flex items-center justify-between px-5 py-4 border-t border-white/5">
						<span className="text-sm text-gray-400">
							Sayfa {page + 1} / {totalPages}
						</span>
						<div className="flex gap-2">
							<button
								onClick={() => setPage(Math.max(0, page - 1))}
								disabled={page === 0}
								className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
							>
								Onceki
							</button>
							<button
								onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
								disabled={page >= totalPages - 1}
								className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
							>
								Sonraki
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
