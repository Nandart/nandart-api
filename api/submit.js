import { IncomingForm } from 'formidable';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import cloudinary from 'cloudinary';

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: {
    bodyParser: false,
  },
};

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function normalizarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = new IncomingForm({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] A processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const {
      nome,
      titulo,
      descricao,
      estilo,
      tecnica,
      ano,
      dimensoes,
      materiais,
      local,
      wallet
    } = fields;

    const imagem = files.imagem?.[0];

    if (!nome || !titulo || !descricao || !imagem) {
      return res.status(400).json({ message: 'Campos obrigatórios em falta' });
    }

    try {
      const upload = await cloudinary.v2.uploader.upload(imagem.filepath, {
        folder: 'nandart',
      });

      const urlImagem = upload.secure_url;

      const corpo = `
**Título:** ${titulo}
**Artista:** ${nome}
**Ano:** ${ano}
**Estilo:** ${estilo}
**Técnica:** ${tecnica}
**Dimensões:** ${dimensoes}
**Materiais:** ${materiais}
**Local:** ${local}

**Descrição:**
${descricao}

**Carteira:** ${wallet}

**Imagem:**  
![Obra](${urlImagem})
`.trim();

      const response = await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${titulo}" por ${nome}`,
        body: corpo,
        labels: ['obra'],
      });

      return res.status(200).json({
        message: 'Submissão recebida com sucesso!',
        url: response.data.html_url,
        imagem: urlImagem,
      });

    } catch (erro) {
      console.error('[ERRO] Upload ou criação de issue:', erro);
      return res.status(500).json({ message: 'Erro ao submeter obra' });
    }
  });
}
