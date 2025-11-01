import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Head from 'next/head';
import ConversionChart from '../../components/Chart';

// Fetcher para SWR
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Filtros multi-site v2
  const [selectedSite, setSelectedSite] = useState('all');
  const [selectedRange, setSelectedRange] = useState('day');
  const [selectedDays, setSelectedDays] = useState('30'); // String para suportar 'today', 'yesterday', '7', etc
  const [lastUpdate, setLastUpdate] = useState(null);

  // Sistema de abas (Geral / Tempo Real)
  const [activeTab, setActiveTab] = useState('general'); // 'general' ou 'realtime'
  const [realtimeTick, setRealtimeTick] = useState(0); // Força recálculo da URL tempo real

  // Filtros de data/hora v3
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('23:59');

  // Verifica autenticação no localStorage
  useEffect(() => {
    const verifyAuth = async () => {
      const authToken = localStorage.getItem('authToken');

      if (authToken) {
        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: authToken, action: 'verify' })
          });

          if (response.ok) {
            setIsAuthenticated(true);
          } else {
            // Token inválido ou expirado
            localStorage.removeItem('authToken');
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Erro ao verificar autenticação:', error);
          localStorage.removeItem('authToken');
          setIsAuthenticated(false);
        }
      }

      setIsCheckingAuth(false);
    };

    verifyAuth();
  }, []);

  // Atualiza o tick da aba Tempo Real a cada 10s para forçar recálculo da janela de 5 minutos
  useEffect(() => {
    if (activeTab === 'realtime') {
      const interval = setInterval(() => {
        setRealtimeTick(prev => prev + 1);
      }, 10000); // 10 segundos

      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Busca lista de sites (sem refresh automático)
  const { data: sitesData } = useSWR(
    isAuthenticated ? '/api/stats?distinct=site' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // Busca stats com filtros multi-site (refresh a cada 30s)
  const statsUrl = useMemo(() => {
    if (!isAuthenticated) return null;

    const params = new URLSearchParams();

    // Aba Tempo Real: últimos 5 minutos, agregação por minuto
    if (activeTab === 'realtime') {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      params.append('range', 'minute'); // Agregação por minuto
      params.append('startDate', fiveMinutesAgo.toISOString());
      params.append('endDate', now.toISOString());
      if (selectedSite && selectedSite !== 'all') {
        params.append('site', selectedSite);
      }
      const url = `/api/stats?${params.toString()}`;
      console.log('🔗 SWR: URL Tempo Real construída', url);
      return url;
    }

    // Aba Geral: usa filtros normais
    params.append('range', selectedRange);

    if (useCustomDates && startDate && endDate) {
      // Modo v3: timestamps específicos (custom dates ativado)
      const start = new Date(`${startDate}T${startTime}`).toISOString();
      const end = new Date(`${endDate}T${endTime}`).toISOString();
      params.append('startDate', start);
      params.append('endDate', end);
    } else {
      // Modo v2: usa dropdown de período
      const now = new Date();

      if (selectedDays === 'today') {
        // Hoje: 00:00 até agora
        const start = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        const end = new Date().toISOString();
        params.append('startDate', start);
        params.append('endDate', end);
      } else if (selectedDays === 'yesterday') {
        // Ontem: dia completo
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
        const end = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
        params.append('startDate', start);
        params.append('endDate', end);
      } else {
        // Números normais (7, 30, 90 dias)
        params.append('days', selectedDays);
      }
    }

    if (selectedSite && selectedSite !== 'all') {
      params.append('site', selectedSite);
    }
    const url = `/api/stats?${params.toString()}`;
    console.log('🔗 SWR: URL construída', url);
    return url;
  }, [isAuthenticated, selectedRange, selectedSite, useCustomDates, startDate, startTime, endDate, endTime, selectedDays, activeTab, realtimeTick]);

  const { data: statsResponse, error, isLoading, isValidating, mutate } = useSWR(
    statsUrl,
    fetcher,
    {
      refreshInterval: activeTab === 'realtime' ? 10000 : 30000, // 10s para tempo real, 30s para geral
      revalidateOnFocus: true,
      revalidateIfStale: true,
      revalidateOnMount: true,
      dedupingInterval: 2000,
      refreshWhenHidden: activeTab === 'realtime', // Continua atualizando tempo real mesmo em aba inativa
      refreshWhenOffline: false,
      onSuccess: (data) => {
        const totalViews = data?.totals?.reduce((sum, s) => sum + (s.views || 0), 0) || 0;
        const totalCompletes = data?.totals?.reduce((sum, s) => sum + (s.completes || 0), 0) || 0;
        console.log('🔄 SWR: Dados atualizados', new Date().toLocaleTimeString('pt-BR'));
        console.log('   📊 Totals recebidos:', data?.totals?.length || 0, 'quizzes');
        console.log('   👁️ Views:', totalViews.toLocaleString());
        console.log('   ✅ Completes:', totalCompletes.toLocaleString());
        console.log('   📦 Bucketed:', data?.bucketed?.length || 0, 'registros');
      },
      onError: (err) => {
        console.error('❌ SWR: Erro ao buscar dados', err);
      }
    }
  );

  // Extrai totals e bucketed da resposta v2
  const stats = statsResponse?.totals || [];
  const bucketed = statsResponse?.bucketed || [];
  const sites = sitesData?.sites || [];

  // Calcula totais
  const totalQuizzes = stats.length;
  const totalViews = stats.reduce((sum, s) => sum + (s.views || 0), 0);
  const totalCompletes = stats.reduce((sum, s) => sum + (s.completes || 0), 0);

  // Atualiza timestamp quando dados mudam
  useEffect(() => {
    if (statsResponse) {
      setLastUpdate(new Date());
      console.log('🔁 Component: Re-renderizando com novos dados');
      console.log('   📊 Quizzes exibidos:', totalQuizzes);
      console.log('   👁️ Views exibidas:', totalViews.toLocaleString());
      console.log('   ✅ Completes exibidas:', totalCompletes.toLocaleString());
    }
  }, [statsResponse, totalQuizzes, totalViews, totalCompletes]);

  // Funções helper para presets de data/hora
  const applyPreset = (preset) => {
    const now = new Date();
    let start, end;

    switch (preset) {
      case 'last-hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        end = now;
        break;
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        start = new Date(yesterday.setHours(0, 0, 0, 0));
        end = new Date(yesterday.setHours(23, 59, 59, 999));
        break;
      case 'last-24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        end = now;
        break;
      case 'last-7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      case 'last-30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      default:
        return;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setStartTime(start.toTimeString().slice(0, 5));
    setEndDate(end.toISOString().split('T')[0]);
    setEndTime(end.toTimeString().slice(0, 5));
    setUseCustomDates(true);
  };

  // Função de login com validação real
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);

    const passwordValue = password.trim();

    if (!passwordValue) {
      setAuthError('Por favor, insira uma senha');
      setIsLoggingIn(false);
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordValue, action: 'login' })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Salva o token retornado pela API
        localStorage.setItem('authToken', data.token);
        setIsAuthenticated(true);
        setAuthError('');
        setPassword('');
      } else {
        setAuthError(data.error || 'Senha incorreta');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setAuthError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setPassword('');
  };

  // Loading enquanto verifica autenticação
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-gray-600 mt-4">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Tela de login
  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>Login - Dashboard</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-8 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800 flex items-center justify-center gap-3">
                <span className="text-4xl">🔒</span>
                Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Sistema de rastreamento de conversão
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha de acesso
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Digite a senha"
                  autoFocus
                />
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-600 text-sm">{authError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold disabled:bg-indigo-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Verificando...
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <p className="text-gray-500 text-xs mt-6 text-center">
              Configure AUTH_TOKEN nas variáveis de ambiente da Vercel
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Dashboard - Conversões de Quizzes v3.0</title>
        <meta name="description" content="Painel de estatísticas de quizzes" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                  <span className="text-4xl">📈</span>
                  Conversões de Quizzes
                  <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded">v3.0</span>
                </h1>
                <p className="text-gray-600 mt-2">
                  {activeTab === 'realtime'
                    ? 'Últimos 5 minutos - Atualização a cada 10 segundos'
                    : 'Estatísticas - Atualização automática a cada 30 segundos'
                  }
                  {lastUpdate && (
                    <span className="text-xs text-gray-500 ml-2">
                      (última: {lastUpdate.toLocaleTimeString('pt-BR')})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => mutate()}
                  disabled={isLoading}
                  className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Atualizar dados agora"
                >
                  🔄 Atualizar
                </button>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900 underline"
                >
                  Sair
                </button>
              </div>
            </div>

            {/* Sistema de Abas */}
            <div className="mt-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`${
                    activeTab === 'general'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  📊 Geral
                </button>
                <button
                  onClick={() => setActiveTab('realtime')}
                  className={`${
                    activeTab === 'realtime'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                >
                  ⚡ Tempo Real
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                    5min
                  </span>
                </button>
              </nav>
            </div>

            {/* Filtros multi-site v2 (apenas aba Geral) */}
            {activeTab === 'general' && (
              <>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro: Site */}
              <div>
                <label htmlFor="site-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Site
                </label>
                <select
                  id="site-filter"
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="all">Todos os sites</option>
                  {sites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro: Período (apenas quando custom dates desativado) */}
              {!useCustomDates && (
                <div>
                  <label htmlFor="period-filter" className="block text-sm font-medium text-gray-700 mb-2">
                    Período
                  </label>
                  <select
                    id="period-filter"
                    value={selectedDays}
                    onChange={(e) => setSelectedDays(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="today">Hoje</option>
                    <option value="yesterday">Ontem</option>
                    <option value="7">Últimos 7 dias</option>
                    <option value="30">Últimos 30 dias</option>
                    <option value="90">Últimos 90 dias</option>
                  </select>
                </div>
              )}

              {/* Filtro: Agregação */}
              <div>
                <label htmlFor="range-filter" className="block text-sm font-medium text-gray-700 mb-2">
                  Agregação
                </label>
                <select
                  id="range-filter"
                  value={selectedRange}
                  onChange={(e) => setSelectedRange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="hour">Por hora</option>
                  <option value="day">Por dia</option>
                  <option value="week">Por semana</option>
                </select>
              </div>
            </div>

            {/* Filtros de Data/Hora v3 */}
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="custom-dates-toggle"
                  checked={useCustomDates}
                  onChange={(e) => setUseCustomDates(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="custom-dates-toggle" className="text-sm font-medium text-gray-700">
                  Usar intervalo de data/hora customizado
                </label>
              </div>

              {useCustomDates && (
                <>
                  {/* Presets rápidos */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => applyPreset('last-hour')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Última hora
                    </button>
                    <button
                      onClick={() => applyPreset('today')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => applyPreset('yesterday')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Ontem
                    </button>
                    <button
                      onClick={() => applyPreset('last-24h')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Últimas 24h
                    </button>
                    <button
                      onClick={() => applyPreset('last-7d')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Últimos 7 dias
                    </button>
                    <button
                      onClick={() => applyPreset('last-30d')}
                      className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Últimos 30 dias
                    </button>
                  </div>

                  {/* Date/Time pickers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data/Hora Início
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Data/Hora Fim
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            </>
            )}

            {/* Filtro simples: Site (apenas aba Tempo Real) */}
            {activeTab === 'realtime' && (
              <div className="mt-6">
                <label htmlFor="site-filter-realtime" className="block text-sm font-medium text-gray-700 mb-2">
                  Filtrar por Site
                </label>
                <select
                  id="site-filter-realtime"
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                >
                  <option value="all">Todos os sites</option>
                  {sites.map((site) => (
                    <option key={site} value={site}>
                      {site}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cards Tempo Real */}
          {activeTab === 'realtime' && !error && statsResponse && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Card: Views */}
              <div className="bg-white rounded-lg shadow-lg p-6 relative">
                {isValidating && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Atualizando..."></div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Views</p>
                    <p className="text-4xl font-bold text-gray-900 mt-2">{totalViews.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">últimos 5 minutos</p>
                  </div>
                  <div className="text-5xl">👁️</div>
                </div>
              </div>

              {/* Card: Completes */}
              <div className="bg-white rounded-lg shadow-lg p-6 relative">
                {isValidating && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Atualizando..."></div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Completes</p>
                    <p className="text-4xl font-bold text-gray-900 mt-2">{totalCompletes.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">últimos 5 minutos</p>
                  </div>
                  <div className="text-5xl">✅</div>
                </div>
              </div>

              {/* Card: Taxa de Conversão */}
              <div className="bg-white rounded-lg shadow-lg p-6 relative">
                {isValidating && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Atualizando..."></div>
                )}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">Taxa de Conversão</p>
                    <p className="text-4xl font-bold text-gray-900 mt-2">
                      {totalViews > 0 ? ((totalCompletes / totalViews) * 100).toFixed(1) : '0.0'}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">últimos 5 minutos</p>
                  </div>
                  <div className="text-5xl">📈</div>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico (apenas aba Geral) */}
          {activeTab === 'general' && !isLoading && !error && stats && stats.length > 0 && (
            <ConversionChart stats={stats} />
          )}

          {/* Conteúdo */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {isLoading && (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-gray-600 mt-4">Carregando estatísticas...</p>
              </div>
            )}

            {error && (
              <div className="p-8 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <p className="text-red-600 font-semibold">Erro ao carregar dados</p>
                <p className="text-gray-600 mt-2">Tente novamente em alguns instantes</p>
              </div>
            )}

            {!isLoading && !error && stats && stats.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <p className="text-gray-600 font-semibold">Nenhum dado ainda</p>
                <p className="text-gray-500 mt-2">
                  Os dados aparecerão assim que os primeiros eventos forem registrados
                </p>
              </div>
            )}

            {!isLoading && !error && stats && stats.length > 0 && (
              <>
                {/* Tabela Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Site
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quiz ID
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Views
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completes
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Taxa de Conversão
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.map((stat, index) => (
                        <tr
                          key={`${stat.site}-${stat.quizId}`}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {stat.site || 'unknown'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {stat.quizId}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-semibold">
                              {stat.views.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-semibold">
                              {stat.completes.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                              parseFloat(stat.conversionRate) >= 50
                                ? 'bg-green-100 text-green-800'
                                : parseFloat(stat.conversionRate) >= 25
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {stat.conversionRate}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards Mobile */}
                <div className="md:hidden p-4 space-y-4">
                  {stats.map((stat) => (
                    <div
                      key={`${stat.site}-${stat.quizId}`}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-1">
                          {stat.site || 'unknown'}
                        </div>
                        <div className="font-semibold text-gray-900 text-lg">
                          {stat.quizId}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Views:</span>
                          <span className="font-semibold text-gray-900">
                            {stat.views.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Completes:</span>
                          <span className="font-semibold text-gray-900">
                            {stat.completes.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Conversão:</span>
                          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            parseFloat(stat.conversionRate) >= 50
                              ? 'bg-green-100 text-green-800'
                              : parseFloat(stat.conversionRate) >= 25
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {stat.conversionRate}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Rodapé com totais */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                    <div>
                      <span className="font-semibold text-gray-900">Total de Quizzes:</span>{' '}
                      {totalQuizzes}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Views:</span>{' '}
                      {totalViews.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Completes:</span>{' '}
                      {totalCompletes.toLocaleString()}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Informações adicionais */}
          <div className="mt-6 text-center text-sm text-gray-600">
            <p>
              Sistema de rastreamento de conversão - Grupo UP Mídia
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
