import { useState, useEffect } from 'react';
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

  // Busca campanhas do quiz
  const { data, error, isLoading } = useSWR(
    isAuthenticated && quizId ? `/api/campaigns/${quizId}` : null,
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
                  Estatísticas por campanha UTM
                </p>
              </div>
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

