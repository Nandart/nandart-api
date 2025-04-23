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
      labels: 'submissão,pendente de revisão',
      state: 'open',
      per_page: 100
    });

    const pendentes = issues
      .filter(issue => issue.title && issue.body)
      .map(issue => {
        const linhas = issue.body.split('\n').map(l => l.trim());

        const extrairCampo = (campo) => {
          const regex = new RegExp(`\\*\\*?\\s*${campo}\\s*:?\\s*\\*\\*?\\s*(.*)`, 'i');
          const linha = linhas.find(l => regex.test(l));
          return linha ? linha.match(regex)[1]?.trim().replace(/^"|"$/g, '') : null;
        };

        const imagemUrl = linhas.find(l => l.includes('![') && l.includes(']('));
        const imagem = imagemUrl
          ? imagemUrl.split('](')[1]?.split(')')[0]?.trim()
          : '';

        return {
          id: issue.number,
          titulo: extrairCampo('Título') || issue.title,
          nomeArtista: extrairCampo('Artista'),
          imagem,
          url: issue.html_url
        };
      })
      .filter(o => o.titulo && o.nomeArtista && o.imagem);

    return res.status(200).json({
      total: pendentes.length,
      pendentes
    });
  } catch (erro) {
    console.error('[ERRO] A obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
