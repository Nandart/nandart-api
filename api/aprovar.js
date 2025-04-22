import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';
const REPO_PUBLIC = 'nandart-galeria';
const BRANCH = process.env.REPO_PUBLIC_BRANCH || 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ message: 'ID da submissão em falta' });
  }

  try {
    // Obter os dados da submissão
    const { data: issue } = await octokit.rest.issues.get({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id
    });

    const titulo = issue.title.replace(/^Nova Submissão: /i, '').replace(/"/g, '').trim();
    const nomeArtista = titulo.includes('por') ? titulo.split('por')[1].trim() : 'Artista Desconhecido';
    const body = issue.body || '';

    const imagemRegex = /!\[.*\]\((.*?)\)/;
    const imagemMatch = body.match(imagemRegex);
    const imagem = imagemMatch ? imagemMatch[1] : '';

    if (!titulo || !nomeArtista || !imagem) {
      return res.status(400).json({ message: 'Dados em falta na submissão' });
    }

    const slug = slugify(`${nomeArtista}-${titulo}`, { lower: true });
    const path = `obras/${slug}.md`;

    const conteudo = `
---
titulo: "${titulo}"
artista: "${nomeArtista}"
imagem: "${imagem}"
slug: "${slug}"
---
`.trim();

    const fileContentEncoded = Buffer.from(conteudo).toString('base64');

    // Obter SHA do branch base (main)
    const { data: repoData } = await octokit.rest.repos.get({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC
    });

    const { data: refData } = await octokit.rest.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `heads/${repoData.default_branch}`
    });

    const baseSha = refData.object.sha;

    const branchName = `aprovacao-${id}-${Date.now()}`;

    // Criar o novo branch
    await octokit.rest.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      ref: `refs/heads/${branchName}`,
      sha: baseSha
    });

    // Adicionar ficheiro da obra
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      path,
      message: `🆕 Adicionar obra: ${titulo}`,
      content: fileContentEncoded,
      branch: branchName
    });

    // Criar Pull Request
    await octokit.rest.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_PUBLIC,
      title: `✨ Aprovação de nova obra: ${titulo}`,
      head: branchName,
      base: repoData.default_branch,
      body: `Esta obra foi aprovada e está pronta para ser integrada na galeria.`
    });

    // Atualizar issue com o rótulo 'aprovada'
    await octokit.rest.issues.update({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: id,
      labels: ['obra', 'aprovada']
    });

    return res.status(200).json({ message: 'Pull Request criada com sucesso!' });

  } catch (erro) {
    console.error('[ERRO] Ao criar PR automático:', erro);
    return res.status(500).json({ message: 'Erro ao criar Pull Request' });
  }
}
