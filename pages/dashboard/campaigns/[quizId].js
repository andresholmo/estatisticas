import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Head from 'next/head';

// Fetcher para SWR
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function CampaignsPage() {
  const router = useRouter();
  const { quizId } = router.query;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Filtros de data/hora (igual ao dashboard principal)
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

  // Função helper para presets de data/hora
  const applyPreset = (preset) => {
    const now = new Date();
    let start, end;

    switch (preset) {
      case 'last-hour':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        end = now;
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

  // Constrói URL da API com filtros de data
  const campaignsUrl = useMemo(() => {
    if (!isAuthenticated || !quizId) return null;

    const params = new URLSearchParams();

    if (useCustomDates && startDate && endDate) {
      // Modo customizado: usa datas/horas selecionadas pelo usuário
      const start = new Date(`${startDate}T${startTime}`).toISOString();
      const end = new Date(`${endDate}T${endTime}`).toISOString();
      params.append('startDate', start);
      params.append('endDate', end);
    } else {
      // Modo padrão: HOJE das 00:00 até AGORA
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      params.append('startDate', todayStart.toISOString());
      params.append('endDate', now.toISOString());
    }

    const url = `/api/campaigns/${quizId}${params.toString() ? `?${params.toString()}` : ''}`;
    return url;
  }, [isAuthenticated, quizId, useCustomDates, startDate, startTime, endDate, endTime]);

  // Busca campanhas do quiz com filtros
  const { data, error, isLoading, mutate } = useSWR(
    campaignsUrl,
    fetcher,
    {
      refreshInterval: 30000, // 30 segundos
      revalidateOnFocus: true,
    }
  );

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

  // Redireciona para login se não autenticado
  if (!isAuthenticated) {
    router.push('/dashboard');
    return null;
  }

  const campaigns = data?.campaigns || [];
  const totals = data?.totals || { views: 0, completes: 0, conversionRate: '0.00%' };

  return (
    <>
      <Head>
        <title>Campanhas - {quizId} - Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Cabeçalho */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="flex justify-between items-start">
              <div>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 flex items-center gap-2"
                >
                  ← Voltar ao Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                  <span className="text-4xl">📊</span>
                  Campanhas - {quizId || 'Carregando...'}
                </h1>
                <p className="text-gray-600 mt-2">
                  Estatísticas de hoje por campanha UTM - Atualização automática a cada 30 segundos
                </p>
              </div>
              <button
                onClick={() => mutate()}
                disabled={isLoading}
                className="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Atualizar dados agora"
              >
                🔄 Atualizar
              </button>
            </div>

            {/* Filtros de Data/Hora */}
            <div className="mt-6 border-t pt-4">
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
          </div>

          {/* Conteúdo */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {isLoading && (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-gray-600 mt-4">Carregando campanhas...</p>
              </div>
            )}

            {error && (
              <div className="p-8 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <p className="text-red-600 font-semibold">Erro ao carregar dados</p>
                <p className="text-gray-600 mt-2">Tente novamente em alguns instantes</p>
              </div>
            )}

            {!isLoading && !error && campaigns.length === 0 && (
              <div className="p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <p className="text-gray-600 font-semibold">Nenhuma campanha encontrada</p>
                <p className="text-gray-500 mt-2">
                  As campanhas aparecerão quando houver eventos com UTM campaign
                </p>
              </div>
            )}

            {!isLoading && !error && campaigns.length > 0 && (
              <>
                {/* Tabela Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Campanha
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
                      {campaigns.map((campaign, index) => (
                        <tr
                          key={campaign.campaign}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {campaign.campaign}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-semibold">
                              {campaign.views.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 font-semibold">
                              {campaign.completes.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                              parseFloat(campaign.conversionRate) >= 50
                                ? 'bg-green-100 text-green-800'
                                : parseFloat(campaign.conversionRate) >= 25
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {campaign.conversionRate}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Cards Mobile */}
                <div className="md:hidden p-4 space-y-4">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.campaign}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="font-semibold text-gray-900 mb-3 text-lg">
                        {campaign.campaign}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Views:</span>
                          <span className="font-semibold text-gray-900">
                            {campaign.views.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Completes:</span>
                          <span className="font-semibold text-gray-900">
                            {campaign.completes.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Conversão:</span>
                          <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                            parseFloat(campaign.conversionRate) >= 50
                              ? 'bg-green-100 text-green-800'
                              : parseFloat(campaign.conversionRate) >= 25
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {campaign.conversionRate}
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
                      <span className="font-semibold text-gray-900">Total de Campanhas:</span>{' '}
                      {campaigns.length}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Views:</span>{' '}
                      {totals.views.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Completes:</span>{' '}
                      {totals.completes.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Taxa de Conversão Geral:</span>{' '}
                      <span className={`px-2 py-1 rounded-full ${
                        parseFloat(totals.conversionRate) >= 50
                          ? 'bg-green-100 text-green-800'
                          : parseFloat(totals.conversionRate) >= 25
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {totals.conversionRate}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

