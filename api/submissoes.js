import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const id = req.query.id;

    try {
      if (id) {
        // Pedir os detalhes de uma submissão específica
        const issue = await octokit.rest.issues.get({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          issue_number: id
        });

        const body = issue.data.body || '';
        const titulo = extrairCampo(body, 'Título');
        const nomeArtista = extrairCampo(body, 'Artista');
        const imagem = extrairImagem(body);

        if (!titulo || !nomeArtista || !imagem) {
          return res.status(400).json({ message: 'Dados em falta na submissão' });
        }

        return res.status(200).json({ titulo, nomeArtista, imagem });
      }

      // Listar submissões pendentes
      const issues = await octokit.rest.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        state: 'open',
        labels: 'obra'
      });

      const pendentes = issues.data
        .filter(issue => !issue.labels.some(l => l.name === 'aprovada'))
        .map(issue => {
          const body = issue.body || '';
          const titulo = extrairCampo(body, 'Título') || 'Sem título';
          const nomeArtista = extrairCampo(body, 'Artista') || 'Artista desconhecido';
          return {
            id: issue.number,
            titulo,
            nomeArtista,
            url: issue.html_url
          };
        });

      return res.status(200).json({ total: pendentes.length, pendentes });
    } catch (erro) {
      console.error('[ERRO] Ao obter submissões:', erro);
      return res.status(500).json({ message: 'Erro ao obter submissões' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}

function extrairCampo(texto, campo) {
  const regex = new RegExp(`${campo}:\\s*(.+)`, 'i');
  const match = texto.match(regex);
  return match ? match[1].trim() : '';
}

function extrairImagem(texto) {
  const match = texto.match(/!\[.*?\]\((.*?)\)/);
  return match ? match[1].trim() : '';
}
