import mongoose from 'mongoose';

const UsuariosCollection = 'usuarios';

const UsuarioSchema = new mongoose.Schema({
    usuario: { type: String, required: true},    
    password: { type: String, required: true}    
})

// UsuarioSchema.methods.encriptarPassword = async (password) => {
//     return await bcrypt.hash(password, bcrypt.genSaltSync(10))
// }


export const usuarios_schema = mongoose.model(UsuariosCollection, UsuarioSchema);