// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { Octokit } from '@octokit/rest';

export const config = {
  api: {
    bodyParser: false
  }
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const form = new formidable.IncomingForm({ multiples: false });

  form.parse(req, async (erro, campos, ficheiros) => {
    if (erro) {
      console.error('Erro ao processar o formulário:', erro);
      return res.status(500).json({ message: 'Erro no processamento do formulário' });
    }

    const {
      nomeArtista, titulo, descricao, estilo, tecnica,
      ano, dimensoes, materiais, local, carteira
    } = campos;

    if (!nomeArtista || !titulo || !descricao || !estilo || !tecnica || !ano || !dimensoes || !materiais || !local || !carteira) {
      return res.status(400).json({ message: 'Dados em falta na submissão' });
    }

    let imagemUrl = '';
    try {
      const imagem = ficheiros.imagem[0];
      const resultadoUpload = await cloudinary.uploader.upload(imagem.filepath, {
        folder: 'nandart-obras',
        public_id: `${nomeArtista}-${titulo}-${Date.now()}`
      });
      imagemUrl = resultadoUpload.secure_url;
    } catch (erroUpload) {
      console.error('Erro ao carregar imagem:', erroUpload);
      return res.status(500).json({ message: 'Erro ao carregar imagem' });
    }

    const corpoIssue = `
**Titulo**: ${titulo}
**Artista**: ${nomeArtista}
**Ano**: ${ano}
**Estilo**: ${estilo}
**Técnica**: ${tecnica}
**Dimensões**: ${dimensoes}
**Materiais**: ${materiais}
**Local**: ${local}
**Descrição**: ${descricao}
**Carteira**: ${carteira}
**Imagem**:
![Obra](${imagemUrl})
    `.trim();

    try {
      const novaIssue = await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${titulo}" por ${nomeArtista}`,
        body: corpoIssue,
        labels: ['submissão', 'pendente de revisão', 'obra']
      });

      return res.status(200).json({ message: 'Submissão registada com sucesso!', issue: novaIssue.data });
    } catch (erroGithub) {
      console.error('Erro ao criar issue no GitHub:', erroGithub);
      return res.status(500).json({ message: 'Erro ao criar a submissão' });
    }
  });
}
