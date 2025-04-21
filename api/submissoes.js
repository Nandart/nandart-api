// File: /api/submissoes.js

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

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      state: 'open',
      labels: 'obra'
    });

    const pendentes = issues
      .filter(issue => {
        const corpo = issue.body || '';
        return corpo.includes('Título:') &&
               corpo.includes('Artista:') &&
               corpo.includes('Imagem:');
      })
      .map(issue => {
        const corpo = issue.body || '';
        const tituloMatch = corpo.match(/Título:\s*(.+)/);
        const artistaMatch = corpo.match(/Artista:\s*(.+)/);
        const imagemMatch = corpo.match(/Imagem:\s*\[.*?\]\((.*?)\)/);

        const titulo = tituloMatch ? tituloMatch[1].trim() : null;
        const nomeArtista = artistaMatch ? artistaMatch[1].trim() : null;
        const imagem = imagemMatch ? imagemMatch[1].trim() : null;

        if (!titulo || !nomeArtista || !imagem) return null;

        return {
          id: issue.number,
          titulo: `🖼️ Nova Submissão: "${titulo}" por ${nomeArtista}`,
          url: issue.html_url,
          criadoEm: issue.created_at
        };
      })
      .filter(Boolean);

    return res.status(200).json({
      total: pendentes.length,
      pendentes
    });
  } catch (erro) {
    console.error('[ERRO] Ao obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
