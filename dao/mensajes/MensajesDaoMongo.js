
import ContenedorMongo from "../../contenedores/ContenedorMongo.js";
// import { mensajes_schema } from "./schemas/mensajes_schema.js";
import { mensajes_schema} from "../../schemas/mensajes_schema.js"

export class MensajeDaoMongo extends ContenedorMongo {
    constructor() {
        super();
        this.tabla = mensajes_schema;
    }

}
