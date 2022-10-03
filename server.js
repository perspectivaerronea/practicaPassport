//ENV
import { } from 'dotenv/config';

//EXPRESS
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { Server as httpServer } from 'http';
import { engine } from 'express-handlebars'

//PATH
import path from 'path';
import { fileURLToPath } from 'url';

//DB
// import ContenedorMongo from "./contenedores/ContenedorMongo.js";
import { ProductoDaoMongo } from './dao/productos/ProductoDaoMongo.js';
import { MensajeDaoMongo } from './dao/mensajes/MensajesDaoMongo.js';
import { UsuarioDaoMongo } from './dao/usuarios/UsuarioDaoMongo.js';

//COOKIE
// import cookieParser, { signedCookie } from 'cookie-parser';

//SESSION
import session from 'express-session';
import MongoStore from 'connect-mongo';

//PASSPORT
import passport from 'passport';
import { Strategy } from 'passport-local';

//FLASH
import flash from 'connect-flash';

//FAKER
import { faker } from '@faker-js/faker';

//NORMALIZR
import { schema, normalize, denormalize } from 'normalizr';

class Usuario {
    constructor(u, p) {
        this.usuario = u;
        this.password = p;
    }
}

async function inicio_mensajes() {
    const ar = new MensajeDaoMongo;
    ar.abrir();

    return ar;
}

async function inicio_productos() {
    const ar = new ProductoDaoMongo;
    ar.abrir();

    return ar;
}

async function inicio_usuarios() {
    const ar = new UsuarioDaoMongo;
    ar.abrir();

    return ar;
}

const app = express();
const httpServerV = new httpServer(app);
const io = new IOServer(httpServerV);
const hbs = { engine };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mensajesDB = await inicio_mensajes();
const productosDB = await inicio_productos();
const usuariosDB = await inicio_usuarios();

function productosFaker() {
    const cantidad = 5;
    const arr = [];

    for (let i = 1; i <= cantidad; i++) {
        arr.push({
            id: i,
            nombre: faker.commerce.product(),
            precio: faker.commerce.price(),
            foto: faker.image.imageUrl(),
        })
    }

    return arr;
}

//Schema para el autor
const schemaAutor = new schema.Entity('autor', {}, { idAttribute: 'email' });

const schemaDoc = new schema.Entity('_doc', { autor: schemaAutor }, { idAttribute: '_id' });

//Schema para el mensaje
const schemaMensaje = new schema.Entity('post', { _doc: schemaDoc });

//Schema para el conjunto de mensajes
const schemaMensajes = new schema.Entity('posts', { post: [schemaMensaje] });

function normalizarMensajes(mensajesSinNormalizar) {
    const debug = false;

    const mensajesNormalizados = normalize(mensajesSinNormalizar, schemaMensajes);

    if (debug) {
        console.log("Sin Normalizar");
        console.log(mensajesSinNormalizar);
        console.log("Normalizados");
        console.log(mensajesNormalizados);
    }

    return mensajesNormalizados;
}

function autorizacion(req, res, next) {    
    if (req.isAuthenticated()) {        
        return next();
    }
    res.status(301).redirect("/");

}

// Sesión
const usuario = [];

//Sesión
const advanceOptions = { useNewUrlParser: true, useUnifiedTopology: true };
const sesionMongo = session({
    store: MongoStore.create({
        mongoUrl: process.env.MONGOATLAS,
        mongoOptions: advanceOptions
    }),
    dbname: process.env.MONTOATLASBASE,
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: (1000 * 60 * 10)
    }
});

/**
 *  (1000 * 60 * 10) = 60000 milisegundos = 10 minutos 
 */

// Configuración Passport
passport.use('registro', new Strategy({ passReqToCallback: true, usernameField: 'newUser', passwordField: 'newPassword' }, async (req, username, password, done) => {

    let nuevoUsuario;

    try {
        try {
            const existeUsuario = await usuariosDB.tabla.findOne({ usuario: username })
            if (existeUsuario) {
                return done(null, false, req.flash('message', "No se puede registrar ese usuario."))
            } else {

                const user = new Usuario(username, password);
                nuevoUsuario = user;
                try {
                    nuevoUsuario.id = await usuariosDB.guardar(user);
                }
                catch (error) {
                    return done(error, false, req.flash('message', "Falló la creación del usuario."))
                }
            }
        } catch (error) {
            return done(error, false, req.flash('message', "Falló la conexión con la base de datos."))
        }

    } catch (error) {
        // todo ok
    }
    
    done(null, nuevoUsuario);
}));

passport.use('login', new Strategy({ passReqToCallback: true, usernameField: 'userLogin', passwordField: 'userPassword' }, async (req, username, password, done) => {
    let usuario;
    try {
        usuario = await usuariosDB.tabla.findOne({ usuario: username })
        if (!usuario) {
            return done(null, false, req.flash('message', "El usuario no existe."))
        } else {
            if (await usuariosDB.valida({ usuario: username, password: password })) {                
                return done(null, usuario);
            } else {
                return done(null, false, req.flash('message', "Contraseña Incorrecta."));
            }
        }
    } catch (error) {
        return done(null, false, req.flash('message', "No se pudo conectar con la DB."));
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id)
});

passport.deserializeUser(async (id, done) => {
    const user = await usuariosDB.obtenerRegistrosPorID(id);
    done(null, user)
});


// Indicamos que queremos cargar los archivos estáticos que se encuentran en dicha carpeta
app.use(express.static('./public'))

//Las siguientes líneas son para que el código reconozca el req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sesionMongo);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());



//Configuro el Engine para usar HandleBars
app.engine('hbs', hbs.engine({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutDir: __dirname + '/views/layouts',
    partialDir: __dirname + '/views/partials'
}));

app.set('views', './views');
app.set('view engine', 'hbs');


// LOGIN

app.get('/', async (req, res) => {
    res.render('main', { layout: 'login' });
})

app.post('/', passport.authenticate('login', {
    successRedirect: '/api',
    failureRedirect: '/failure',
    passReqToCallback: true
}))

// REGISTRO

app.get('/register', async (req, res) => {
    res.render('main', { layout: 'register' });
})

app.post('/register', passport.authenticate('registro', {
    successRedirect: '/api',
    failureRedirect: '/failure',
    passReqToCallback: true
}));

app.get('/failure', (req, res) => {    
    res.render('main', { layout: 'failure', message: req.flash('message') });
})

// PRINCIPAL

app.get('/api', autorizacion, async (req, res) => {
    //Creo la cookie con el nombre de usuario    
    usuario.push(req.user.usuario)
    res.status(201).render('./partials/tabla', { usuario: req.user.usuario});
});

app.get('/api/productos-test', autorizacion, async (req, res) => {
    res.render('main', { layout: 'productosPrueba', listaProductosPrueba: productosFaker() });
});

// LOGOUT

app.get('/api/logout', (req, res, next) => {    
    req.logout(function (err) {
        if (err) { return next(err); }
        res.render('main', { layout: 'logout', usuario: usuario[usuario.length - 1] });
    });
});

// MENSAJES

io.on('connection', (socket) => {

    socket.on('nuevoUsuario', async () => {

        //Envio Lista de Productos                
        const arr = await productosDB.obtenerRegistros();
        const listaProductos = arr;

        io.sockets.emit('listaProductos', listaProductos);

        //Envio Mensajes en el Chat
        const msg = await mensajesDB.obtenerRegistros();

        //Obtención Mensajes Normalizados
        const arrMsgN = normalizarMensajes({ id: 'mensajes', post: msg });

        io.sockets.emit('mensaje', arrMsgN);

    })

    socket.on('nuevoProducto', async (pr) => {

        await productosDB.guardar(pr)
        const listaProductos = await productosDB.obtenerRegistros();

        io.sockets.emit('listaProductos', listaProductos);
    })

    socket.on('nuevoMensaje', async (data) => {

        await mensajesDB.guardar(data)
        const msg = await mensajesDB.obtenerRegistros();

        const arrMsgN = normalizarMensajes({ id: 'mensajes', post: msg });

        io.sockets.emit('mensaje', arrMsgN);
    });

})

// El servidor funcionando en el puerto 3000
httpServerV.listen(process.env.PORT, () => console.log('SERVER ON'));