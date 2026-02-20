import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import useAuth from '@/hooks/use-auth';
import { admin } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

interface Stats {
  total_users: number;
  new_users_week: number;
  total_balance: number;
  total_projects: number;
  total_purchases: number;
  revenue: number;
  transactions_today: number;
}

interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  balance: number;
  projects_count: number;
}

interface AdminTransaction {
  id: number;
  user_id: number;
  email: string;
  user_name: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

const Admin = () => {
  const { user, isAuthenticated, isAdmin, loadProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [txList, setTxList] = useState<AdminTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [adjustModal, setAdjustModal] = useState<{ userId: number; name: string } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile().then(() => {
      const state = useAuth.getState();
      if (!state.isAuthenticated || !state.isAdmin) {
        navigate('/auth');
        return;
      }
      loadAll();
    });
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, u, t] = await Promise.all([
        admin.stats(),
        admin.users(50),
        admin.transactions(50),
      ]);
      setStats(s);
      setUsers(u.users || []);
      setTotalUsers(u.total || 0);
      setTxList(t.items || []);
    } catch {}
    setLoading(false);
  };

  const handleSearch = useCallback(async () => {
    try {
      const res = await admin.users(50, 0, search);
      setUsers(res.users || []);
      setTotalUsers(res.total || 0);
    } catch {}
  }, [search]);

  const toggleUserActive = async (u: AdminUser) => {
    try {
      await admin.updateUser({ user_id: u.id, is_active: !u.is_active });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
    } catch {}
  };

  const toggleUserRole = async (u: AdminUser) => {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    try {
      await admin.updateUser({ user_id: u.id, role: newRole });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
    } catch {}
  };

  const handleAdjustBalance = async () => {
    if (!adjustModal) return;
    const amount = parseFloat(adjustAmount);
    if (!amount) return;
    try {
      await admin.adjustBalance(adjustModal.userId, amount, adjustReason || 'Корректировка админом');
      setAdjustModal(null);
      setAdjustAmount('');
      setAdjustReason('');
      loadAll();
    } catch {}
  };

  if (loading && !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--editor-bg))' }}>
        <Icon name="Loader2" size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  const statCards = stats ? [
    { label: 'Пользователи', value: stats.total_users, icon: 'Users', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Новые за неделю', value: stats.new_users_week, icon: 'UserPlus', color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Проекты', value: stats.total_projects, icon: 'Film', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Покупки', value: stats.total_purchases, icon: 'ShoppingBag', color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: 'Общий баланс', value: stats.total_balance.toFixed(0) + ' ₽', icon: 'Wallet', color: 'text-green-400', bg: 'bg-green-500/10' },
    { label: 'Выручка', value: stats.revenue.toFixed(0) + ' ₽', icon: 'TrendingUp', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { label: 'Транзакции сегодня', value: stats.transactions_today, icon: 'Activity', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ] : [];

  return (
    <div className="min-h-screen" style={{ background: 'hsl(var(--editor-bg))' }}>
      <header className="border-b border-border" style={{ background: 'hsl(var(--editor-panel))' }}>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Icon name="Shield" size={16} className="text-red-400" />
              </div>
              <span className="font-semibold text-sm">Админ-панель</span>
            </button>
            <Separator orientation="vertical" className="h-6 bg-border/50" />
            <span className="text-xs text-muted-foreground">VideoForge</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="nle-button flex items-center gap-1.5">
              <Icon name="User" size={12} /> Кабинет
            </button>
            <button onClick={() => navigate('/')} className="nle-button flex items-center gap-1.5">
              <Icon name="Clapperboard" size={12} /> Редактор
            </button>
            <button onClick={loadAll} className="nle-button">
              <Icon name="RefreshCw" size={12} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {statCards.map(s => (
              <div key={s.label} className="editor-panel rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                    <Icon name={s.icon} size={14} className={s.color} />
                  </div>
                </div>
                <div className="text-lg font-bold">{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="bg-transparent gap-1">
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              <Icon name="Users" size={12} className="mr-1.5" /> Пользователи ({totalUsers})
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              <Icon name="Activity" size={12} className="mr-1.5" /> Транзакции
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="editor-panel rounded-xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Поиск по email или имени..."
                  className="max-w-sm bg-secondary/50 border-border text-sm"
                />
                <button onClick={handleSearch} className="nle-button active">
                  <Icon name="Search" size={12} />
                </button>
              </div>

              <ScrollArea className="editor-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">ID</th>
                      <th className="text-left py-2 px-3 font-medium">Пользователь</th>
                      <th className="text-left py-2 px-3 font-medium">Роль</th>
                      <th className="text-left py-2 px-3 font-medium">Баланс</th>
                      <th className="text-left py-2 px-3 font-medium">Проекты</th>
                      <th className="text-left py-2 px-3 font-medium">Дата</th>
                      <th className="text-left py-2 px-3 font-medium">Статус</th>
                      <th className="text-right py-2 px-3 font-medium">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                        <td className="py-2.5 px-3 text-muted-foreground">#{u.id}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium">{u.name}</div>
                          <div className="text-[10px] text-muted-foreground">{u.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <button onClick={() => toggleUserRole(u)} className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {u.role === 'admin' ? 'Админ' : 'Пользователь'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-green-400 font-medium">{u.balance.toFixed(0)} ₽</td>
                        <td className="py-2.5 px-3">{u.projects_count}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ru-RU')}</td>
                        <td className="py-2.5 px-3">
                          <Switch checked={u.is_active} onCheckedChange={() => toggleUserActive(u)} />
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button onClick={() => setAdjustModal({ userId: u.id, name: u.name })} className="nle-button text-[10px]">
                            <Icon name="Wallet" size={10} className="inline mr-1" /> Баланс
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            <div className="editor-panel rounded-xl p-4">
              <ScrollArea className="h-96 editor-scrollbar">
                <div className="space-y-1">
                  {txList.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                          <Icon name={tx.amount > 0 ? 'ArrowDownLeft' : 'ArrowUpRight'} size={14} className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'} />
                        </div>
                        <div>
                          <div className="text-xs font-medium">{tx.description || tx.type}</div>
                          <div className="text-[10px] text-muted-foreground">{tx.user_name} ({tx.email})</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} ₽
                        </div>
                        <div className="text-[10px] text-muted-foreground">{new Date(tx.created_at).toLocaleString('ru-RU')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {adjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="editor-panel rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-sm font-semibold mb-1">Корректировка баланса</h3>
            <p className="text-xs text-muted-foreground mb-4">{adjustModal.name} (ID: {adjustModal.userId})</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Сумма (+ начислить, - списать)</label>
                <Input
                  type="number"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="100 или -50"
                  className="mt-1 bg-secondary/50 border-border"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Причина</label>
                <Input
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Причина корректировки"
                  className="mt-1 bg-secondary/50 border-border"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdjustBalance} className="flex-1 py-2 rounded font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90">
                  Применить
                </button>
                <button onClick={() => setAdjustModal(null)} className="flex-1 nle-button py-2">
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
