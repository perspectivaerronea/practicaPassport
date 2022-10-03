
import ContenedorMongo from "../../contenedores/ContenedorMongo.js";
import { usuarios_schema} from "../../schemas/usuarios_schema.js"
import bcrypt from 'bcrypt';

const rounds = 10;


export class UsuarioDaoMongo extends ContenedorMongo {
    constructor() {
        super();
        this.tabla = usuarios_schema;
    }

    async guardar(elemento) {
        try {                        
            
            elemento.password =  await bcrypt.hash(elemento.password, bcrypt.genSaltSync(rounds));                                    
            const nuevoUsuario = new this.tabla(elemento);
            await nuevoUsuario.save();            
            return nuevoUsuario._id;
        }
        catch (error) {
            console.log("No se pudo crear el usuario. " + error);
            return null;
        }
    }

    async valida(elemento) {
        const usuario = await this.tabla.findOne({usuario:elemento.usuario})
        if(usuario){
            
            const verifica =  await bcrypt.compareSync(elemento.password, usuario.password);                                                

            if(verifica)
            {
                return true;
            }
        }
        return false;
    }

}