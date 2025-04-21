// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH_BASE = process.env.REPO_PUBLIC_BRANCH || 'main';

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id, titulo, nomeArtista, imagem } = req.body;

  if (!id || !titulo || !nomeArtista || !imagem) {
    return res.status(400).json({ message: 'Dados em falta na submissão' });
  }

  try {
    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true, strict: true });
    const caminhoFicheiro = `obras/${slug}.md`;

    const conteudo = `
---
titulo: "${titulo}"
artista: "${nomeArtista}"
imagem: "${imagem}"
slug: "${slug}"
---
    `.trim();

    const conteudoCodificado = Buffer.from(conteudo).toString('base64');

    // Obter SHA do último commit da branch base
    const baseInfo = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC
    });

    const shaBase = (
      await octokit.rest.git.getRef({
        owner: REPO_OWNER,
        repo: REPO_PUBLIC,
        ref: `heads/${BRANCH_BASE}`
      })
    ).data.object.sha;

    // Criar novo branch para aprovação
    const nomeBranch = `aprovacao-${id}-${Date.now()}`;
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${nomeBranch}`,
      sha: shaBase
    });

    // Adicionar ficheiro com os dados da obra
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path: caminhoFicheiro,
      message: `🆕 Adicionar obra: ${titulo}`,
      content: conteudoCodificado,
      branch: nomeBranch
    });

    // Criar Pull Request
    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `✨ Aprovação de nova obra: ${titulo}`,
      head: nomeBranch,
      base: BRANCH_BASE,
      body: `A obra "${titulo}" de ${nomeArtista} foi aprovada e aguarda integração na galeria.`
    });

    // Atualizar estado da submissão original (issue)
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: Number(id),
      labels: ['obra', 'aprovada']
    });

    return res.status(200).json({ message: 'Pull Request criado com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] Ao criar PR automático:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request' });
  }
}
