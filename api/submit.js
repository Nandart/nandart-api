// File: /api/submit.js

import { Octokit } from '@octokit/rest';
import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

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

const REPO_OWNER = 'Nandart';
const REPO_NAME = 'nandart-submissoes';

function sanitize(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s\-.,;:!?()&]/gi, '')
    .trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Método não permitido' });

  try {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('[ERRO] Ao processar o formulário:', err);
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
        wallet
      } = fields;

      const imagem = files.imagem;

      if (
        !nomeArtista || !titulo || !descricao || !estilo || !tecnica || !ano ||
        !dimensoes || !materiais || !local || !wallet || !imagem
      ) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios devem ser preenchidos' });
      }

      const path = imagem.filepath || imagem.path;

      const resultadoUpload = await cloudinary.uploader.upload(path, {
        folder: 'nandart',
        use_filename: true,
        unique_filename: false
      });

      const urlImagem = resultadoUpload.secure_url;

      const corpo = `
**Titulo**: ${sanitize(titulo)}
**Artista**: ${sanitize(nomeArtista)}
**Ano**: ${sanitize(ano)}
**Estilo**: ${sanitize(estilo)}
**Técnica**: ${sanitize(tecnica)}
**Dimensões**: ${sanitize(dimensoes)}
**Materiais**: ${sanitize(materiais)}
**Local**: ${sanitize(local)}

**Descrição**:  
${sanitize(descricao)}

**Carteira**: \`${sanitize(wallet)}\`  
**Imagem**:  
![Obra](${urlImagem})
`.trim();

      await octokit.rest.issues.create({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        title: `Nova Submissão: "${sanitize(titulo)}" por ${sanitize(nomeArtista)}`,
        body: corpo,
        labels: ['obra']
      });

      return res.status(200).json({ message: 'Submissão registada com sucesso!' });
    });
  } catch (erro) {
    console.error('[ERRO] Submissão falhou:', erro);
    return res.status(500).json({ message: 'Erro ao processar submissão' });
  }
}
