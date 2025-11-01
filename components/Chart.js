import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export default function ConversionChart({ stats }) {
  if (!stats || stats.length === 0) {
    return null;
  }

  // Prepara dados para o gráfico (multi-site v2)
  const chartData = stats.map(stat => ({
    label: `${stat.quizId} (${stat.site || 'unknown'})`,
    quizId: stat.quizId,
    site: stat.site || 'unknown',
    conversao: parseFloat(stat.conversionRate),
    views: stat.views,
    completes: stat.completes,
  }));

  // Função para determinar cor da barra baseada na taxa
  const getBarColor = (value) => {
    if (value >= 50) return '#10b981'; // verde
    if (value >= 25) return '#f59e0b'; // amarelo
    return '#ef4444'; // vermelho
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Gráfico de Conversão</h2>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            angle={-45}
            textAnchor="end"
            height={100}
            interval={0}
          />
          <YAxis
            label={{ value: 'Taxa de Conversão (%)', angle: -90, position: 'insideLeft' }}
            domain={[0, 100]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-4 border border-gray-300 rounded shadow-lg">
                    <p className="font-semibold text-gray-900">{data.quizId}</p>
                    <p className="text-xs text-gray-500 mb-2">{data.site}</p>
                    <p className="text-sm text-gray-600">
                      Taxa de conversão: <span className="font-bold">{data.conversao.toFixed(1)}%</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Views: <span className="font-bold">{data.views}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Completes: <span className="font-bold">{data.completes}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            content={() => (
              <div className="flex justify-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>≥ 50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>≥ 25%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>&lt; 25%</span>
                </div>
              </div>
            )}
          />
          <Bar dataKey="conversao" name="Taxa de Conversão (%)">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.conversao)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
