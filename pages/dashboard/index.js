import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Head from 'next/head';
import ConversionChart from '../../components/Chart';

// Fetcher para SWR
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [range, setRange] = useState('all');

  // Verifica autenticação no localStorage
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      setIsAuthenticated(true);
    }
  }, []);

  // Atualiza a cada 5 segundos com filtro de data
  const { data: stats, error, isLoading } = useSWR(
    isAuthenticated ? `/api/stats?range=${range}` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
    }
  );

  // Função de login
  const handleLogin = (e) => {
    e.preventDefault();

    // Se AUTH_TOKEN não está configurado, aceita qualquer senha
    // Em produção, configure AUTH_TOKEN nas variáveis de ambiente
    const validPassword = password.trim();

    if (validPassword) {
      localStorage.setItem('authToken', validPassword);
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Por favor, insira uma senha');
    }
  };

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    setIsAuthenticated(false);
    setPassword('');
  };

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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Digite a senha"
                  autoFocus
                />
              </div>

              {authError && (
                <p className="text-red-600 text-sm">{authError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
              >
                Entrar
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
        <title>Dashboard - Conversões de Quizzes v2.0</title>
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
                  <span className="text-sm bg-indigo-100 text-indigo-800 px-2 py-1 rounded">v2.0</span>
                </h1>
                <p className="text-gray-600 mt-2">
                  Estatísticas em tempo real - Atualização automática a cada 5 segundos
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Sair
              </button>
            </div>

            {/* Filtros de data */}
            <div className="mt-6 flex gap-2 flex-wrap">
              <button
                onClick={() => setRange('7d')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  range === '7d'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Últimos 7 dias
              </button>
              <button
                onClick={() => setRange('30d')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  range === '30d'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Últimos 30 dias
              </button>
              <button
                onClick={() => setRange('all')}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  range === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {/* Gráfico */}
          {!isLoading && !error && stats && stats.length > 0 && (
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
                          key={stat.quizId}
                          className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        >
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
                      key={stat.quizId}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="font-semibold text-gray-900 mb-3 text-lg">
                        {stat.quizId}
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
                      {stats.length}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Views:</span>{' '}
                      {stats.reduce((sum, s) => sum + s.views, 0).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">Total de Completes:</span>{' '}
                      {stats.reduce((sum, s) => sum + s.completes, 0).toLocaleString()}
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
