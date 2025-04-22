// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

export const config = {
  api: {
    bodyParser: true,
  },
};

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const REPO_OWNER = 'Nandart';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH_BASE = process.env.REPO_PUBLIC_BRANCH || 'main';
const REPO_ISSUES = 'nandart-submissoes';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: 'ID da submissão em falta' });
  }

  try {
    const { data: issue } = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_ISSUES,
      issue_number: id,
    });

    const regex = /(?<=\*\*🎨 Título:\*\* )(.+?)\s*\n.*?\*\*🧑‍🎨 Artista:\*\* (.+?)\s*\n.*?\*\*📅 Ano:\*\* (.+?)\s*\n.*?\*\*🖌️ Estilo:\*\* (.+?)\s*\n.*?\*\*🧵 Técnica:\*\* (.+?)\s*\n.*?\*\*📐 Dimensões:\*\* (.+?)\s*\n.*?\*\*🧱 Materiais:\*\* (.+?)\s*\n.*?\*\*🌍 Local:\*\* (.+?)\s*\n[\s\S]*?\*\*📝 Descrição:\*\*\s*\n([\s\S]*?)\n\n\*\*👛 Carteira:\*\* `(.+?)`\s*\n.*?!\[Obra\]\((.+?)\)/;

    const match = issue.body.match(regex);

    if (!match) {
      return res.status(500).json({ message: 'Não foi possível extrair os dados da issue.' });
    }

    const [
      ,
      titulo,
      nomeArtista,
      ano,
      estilo,
      tecnica,
      dimensoes,
      materiais,
      local,
      descricao,
      enderecowallet,
      imagem,
    ] = match;

    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true });
    const filePath = `galeria/obras/${slug}.json`;

    const obra = {
      titulo,
      nomeArtista,
      ano,
      estilo,
      tecnica,
      dimensoes,
      materiais,
      local,
      descricao,
      enderecowallet,
      imagem,
      slug,
    };

    const conteudoJSON = Buffer.from(JSON.stringify(obra, null, 2)).toString('base64');

    const { data: repo } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
    });

    const sha = repo.default_branch;

    const { data: latestCommit } = await octokit.rest.repos.getCommit({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: BRANCH_BASE,
    });

    const branchName = `aprovacao-${slug}-${Date.now()}`;

    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${branchName}`,
      sha: latestCommit.sha,
    });

    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path: filePath,
      message: `Adicionar obra: ${titulo}`,
      content: conteudoJSON,
      branch: branchName,
    });

    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `Aprovação de obra: ${titulo}`,
      head: branchName,
      base: BRANCH_BASE,
      body: `Esta obra foi aprovada e está pronta para ser integrada na galeria pública.`,
    });

    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_ISSUES,
      issue_number: id,
      labels: ['aprovada', 'obra'],
    });

    res.status(200).json({ message: 'Pull Request criado com sucesso!' });
  } catch (erro) {
    console.error('[ERRO] A criar PR automático:', erro);
    res.status(500).json({ message: 'Erro ao criar Pull Request ou processar aprovação' });
  }
}
