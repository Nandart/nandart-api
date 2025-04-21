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

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function limparTexto(texto) {
  return texto.normalize ? texto.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s\-]/gi, '') : texto;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  const form = formidable({ multiples: false });

  try {
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[ERRO] Ao analisar formulário:', err);
        return res.status(500).json({ message: 'Erro ao processar o formulário' });
      }

      const {
        nomeArtista,
        titulo,
        descricao,
        estilo,
        tecnica,
        ano,
        dimensoes,
        materiais,
        local,
        carteira
      } = fields;

      if (!files.imagem || !titulo || !nomeArtista) {
        return res.status(400).json({ message: 'Faltam dados obrigatórios' });
      }

      const imagemPath = files.imagem[0].filepath;
      const upload = await cloudinary.uploader.upload(imagemPath, {
        folder: 'nandart',
        use_filename: true
      });

      const imagemUrl = upload.secure_url;

      const corpo = `
**Título**: ${titulo}
**Artista**: ${nomeArtista}
**Ano**: ${ano}
**Estilo**: ${estilo}
**Técnica**: ${tecnica}
**Dimensões**: ${dimensoes}
**Materiais**: ${materiais}
**Local**: ${local}

**Descrição**:  
${descricao}

**Carteira**: \`${carteira}\`  
**Imagem**:  
![Obra](${imagemUrl})
`;

      const tituloIssue = `Nova Submissão: "${titulo}" por ${nomeArtista}`;

      const issue = await octokit.rest.issues.create({
        owner: 'Nandart',
        repo: 'nandart-submissoes',
        title: tituloIssue,
        body: corpo,
        labels: ['obra']
      });

      return res.status(200).json({ message: 'Submissão recebida com sucesso!', issue: issue.data.html_url });
    });
  } catch (erro) {
    console.error('[ERRO] Upload ou criação de issue:', erro);
    return res.status(500).json({ message: 'Erro ao processar a submissão' });
  }
}
