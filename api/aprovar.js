// File: /api/aprovar.js

import { Octokit } from '@octokit/rest';
import slugify from 'slugify';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = 'Nandart';
const REPO = 'nandart-galeria-publica';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const { nomeArtista, titulo, imageUrl } = body;

    if (!nomeArtista || !titulo || !imageUrl) {
      return res.status(400).json({ message: 'Dados incompletos para criar PR' });
    }

    const timestamp = Date.now();
    const slug = slugify(`${titulo}-${nomeArtista}-${timestamp}`, { lower: true, strict: true });
    const filename = `obras/${slug}.json`;

    const conteudo = {
      artista: nomeArtista,
      titulo,
      imagem: imageUrl,
      aprovadoEm: new Date().toISOString()
    };

    const contentEncoded = Buffer.from(JSON.stringify(conteudo, null, 2)).toString('base64');

    const branchName = `add-obra-${slug}`;
    const { data: master } = await octokit.repos.getBranch({ owner: OWNER, repo: REPO, branch: 'main' });

    await octokit.git.createRef({
      owner: OWNER,
      repo: REPO,
      ref: `refs/heads/${branchName}`,
      sha: master.commit.sha
    });

    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: filename,
      message: `🎨 Nova obra: ${titulo} por ${nomeArtista}`,
      content: contentEncoded,
      branch: branchName
    });

    const { data: pr } = await octokit.pulls.create({
      owner: OWNER,
      repo: REPO,
      title: `✨ Aprovação da obra "${titulo}"`,
      head: branchName,
      base: 'main',
      body: `Obra aprovada automaticamente pelo painel de curadoria.\n\n🎨 **${titulo}**\n👤 *${nomeArtista}*`
    });

    return res.status(200).json({ message: 'Pull Request criado com sucesso', prUrl: pr.html_url });

  } catch (erro) {
    console.error('[ERRO] Ao criar PR automático:', erro);
    return res.status(500).json({ message: 'Erro ao criar PR automático' });
  }
}
