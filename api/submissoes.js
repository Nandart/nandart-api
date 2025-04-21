// File: /api/submissoes.js

import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false,
  },
};

// 🐙 GitHub
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
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
      labels: 'submissão,pendente de revisão,obra',
      per_page: 100
    });

    const pendentes = [];

    for (const issue of issues) {
      const body = issue.body || '';
      const id = issue.number;
      const titulo = issue.title;
      const url = issue.html_url;
      const criadoEm = issue.created_at;

      const camposEsperados = ['**🎨 Título:**', '**🧑‍🎨 Artista:**', '**📅 Ano:**', '**🖌️ Estilo:**', '**🧵 Técnica:**', '**📐 Dimensões:**', '**🧱 Materiais:**', '**🌍 Local:**', '**📝 Descrição:**', '**👛 Carteira:**', '**📷 Imagem:**'];

      const corpoValido = camposEsperados.every(campo => body.includes(campo));

      if (!corpoValido) {
        console.warn(`[AVISO] A issue #${id} está com o corpo incompleto ou mal formatado.`);
      }

      pendentes.push({ id, titulo, url, criadoEm, corpoValido });
    }

    return res.status(200).json({ total: pendentes.length, pendentes });
  } catch (erro) {
    console.error('[ERRO] Ao obter submissões:', erro);
    return res.status(500).json({ message: 'Erro ao obter submissões' });
  }
}
