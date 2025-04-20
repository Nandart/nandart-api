// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import fetch from 'node-fetch';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Configuração do Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  console.log('[LOG] Endpoint /api/submit foi chamado');

  if (req.method !== 'POST') {
    console.warn('[ERRO] Método não permitido');
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('[ERRO] Ao processar o formulário:', err);
      return res.status(500).json({ message: 'Erro ao processar o formulário' });
    }

    const { titulo, descricao, enderecowallet } = fields;
    const imagem = files.imagem;

    if (!titulo || !descricao || !enderecowallet || !imagem) {
      console.warn('[AVISO] Campos obrigatórios em falta');
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    try {
      const filePath = imagem.filepath || imagem.path;

      // Upload da imagem para o Cloudinary
      const uploadResponse = await cloudinary.uploader.upload(filePath, {
        folder: 'nandart-submissoes',
      });

      const imageUrl = uploadResponse.secure_url;
      console.log('[LOG] Upload bem-sucedido:', imageUrl);

      // Criação da issue no GitHub
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      const REPO = 'nandart/nandart-submissoes';

      const issueBody = `
**🎨 Título da Obra:** ${titulo}
**🖋️ Descrição:**  
${descricao}

**🏦 Endereço da Wallet:** ${enderecowallet}
**🖼️ Imagem Submetida:** [Ver imagem](${imageUrl})
`;

      const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          title: `Nova Obra: ${titulo}`,
          body: issueBody,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[ERRO] Ao criar issue no GitHub:', errorText);
        return res.status(500).json({ message: 'Erro ao criar issue no GitHub', details: errorText });
      }

      return res.status(200).json({
        message: 'Submissão recebida com sucesso!',
        imageUrl,
      });
    } catch (uploadError) {
      console.error('[ERRO] Ao fazer upload para Cloudinary:', uploadError);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem', details: uploadError.message });
    }
  });
}
