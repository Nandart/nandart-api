// File: /api/submit.js

import formidable from 'formidable';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';

export const config = {
  api: {
    bodyParser: false,
  },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  console.log('[LOG] Endpoint /api/submit foi chamado');

  if (req.method !== 'POST') {
    console.log('[ERRO] Método não permitido');
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

    console.log('[LOG] Campos recebidos:', { titulo, descricao, enderecowallet });
    console.log('[LOG] Imagem recebida:', imagem);

    if (!titulo || !descricao || !enderecowallet || !imagem) {
      console.warn('[AVISO] Campos obrigatórios em falta');
      return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
    }

    try {
      const filePath = imagem.filepath || imagem.path;

      const uploadResponse = await cloudinary.uploader.upload(filePath);
      console.log('[LOG] Upload para Cloudinary bem-sucedido:', uploadResponse.secure_url);

      return res.status(200).json({
        message: 'Submissão recebida com sucesso!',
        imageUrl: uploadResponse.secure_url,
      });
    } catch (uploadError) {
      console.error('[ERRO] Ao fazer upload para Cloudinary:', uploadError);
      return res.status(500).json({ message: 'Erro ao fazer upload da imagem' });
    }
  });
}
