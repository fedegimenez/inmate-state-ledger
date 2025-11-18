// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EventRegistry} from "./EventRegistry.sol";

contract InmateStateLedger is AccessControl {
    bytes32 public constant ROL_GUARDIA = keccak256("ROL_GUARDIA");
    bytes32 public constant ROL_MEDICO  = keccak256("ROL_MEDICO");
    bytes32 public constant ROL_SOCIAL  = keccak256("ROL_SOCIAL");
    bytes32 public constant ROL_ADMIN   = keccak256("ROL_ADMIN");
    bytes32 public constant ROL_JUEZ    = keccak256("ROL_JUEZ");

    enum Estado { NONE, INGRESADO, EN_TRASLADO, SANCIONADO, EN_REHABILITACION, LIBERADO }

    struct InmateRecord {
        bytes32 idInternoHash;
        string nombre;
        Estado estadoActual;
        uint256 fechaUltimaActualizacion;
        address rolUltimoActor;
        string  ubicacionActual;
        uint256[] eventos;
        bytes32 hashExpediente;
        bool existe;
    }

    mapping(bytes32 => InmateRecord) private _inmates;
    EventRegistry public registry;

    error InvalidaTransicion(Estado actual, Estado requerida);
    error InternoNoExiste();
    error InternoYaExiste();

    event EstadoActualizado(bytes32 indexed idInternoHash, Estado nuevoEstado);

    constructor(address admin, EventRegistry _registry) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ROL_ADMIN, admin);
        registry = _registry;
    }

    function _log(
        bytes32 idInternoHash,
        EventRegistry.TipoEvento tipo,
        string memory descripcion,
        bytes32 hashEvento
    ) internal {
        InmateRecord storage ir = _inmates[idInternoHash];
        uint8 estadoAsociado = uint8(ir.estadoActual);
        uint256 idEv = registry.registrar(
            idInternoHash, tipo, descripcion, hashEvento, estadoAsociado
        );
        ir.eventos.push(idEv);
        ir.fechaUltimaActualizacion = block.timestamp;
        ir.rolUltimoActor = msg.sender; // antes usabas tx.origin

        // rolling hash del expediente: deriva del historial, no manual
        ir.hashExpediente = keccak256(
            abi.encodePacked(
                ir.hashExpediente,
                idInternoHash,
                tipo,
                hashEvento,
                estadoAsociado,
                block.timestamp
            )
        );
    }

    // firma NUEVA: id, alias, ubicacionInicial, hashEvento
    function ingresarInterno(
        bytes32 idInternoHash,
        string calldata nombre,
        string calldata ubicacionInicial,
        bytes32 hashEvento
    ) external onlyRole(ROL_GUARDIA) {
        if (_inmates[idInternoHash].existe) revert InternoYaExiste();
        InmateRecord storage ir = _inmates[idInternoHash];
        ir.idInternoHash = idInternoHash;
        ir.nombre = nombre;          
        ir.estadoActual = Estado.INGRESADO;
        ir.ubicacionActual = ubicacionInicial;
        ir.existe = true;

        _log(idInternoHash, EventRegistry.TipoEvento.Ingreso, "Ingreso a establecimiento", hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.INGRESADO);
    }


    function ordenarTraslado(
        bytes32 idInternoHash,
        string calldata destino,
        bytes32 hashEvento
    ) external onlyRole(ROL_ADMIN) {
        InmateRecord storage ir = _get(idInternoHash);
        if (
            ir.estadoActual != Estado.INGRESADO &&
            ir.estadoActual != Estado.SANCIONADO &&
            ir.estadoActual != Estado.EN_REHABILITACION
        ) revert InvalidaTransicion(ir.estadoActual, Estado.EN_TRASLADO);

        ir.estadoActual = Estado.EN_TRASLADO;
        ir.ubicacionActual = string(abi.encodePacked("En traslado -> ", destino));
        _log(idInternoHash, EventRegistry.TipoEvento.OrdenDeTraslado, "Orden de traslado emitida", hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.EN_TRASLADO);
    }

    function arriboDestino(
        bytes32 idInternoHash,
        string calldata nuevaUbicacion,
        bytes32 hashEvento
    ) external onlyRole(ROL_GUARDIA) {
        InmateRecord storage ir = _get(idInternoHash);
        if (ir.estadoActual != Estado.EN_TRASLADO)
            revert InvalidaTransicion(ir.estadoActual, Estado.EN_TRASLADO);
        ir.estadoActual = Estado.INGRESADO;
        ir.ubicacionActual = nuevaUbicacion;
        _log(idInternoHash, EventRegistry.TipoEvento.ArriboADestino, "Arribo confirmado", hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.INGRESADO);
    }

    function aplicarSancion(
        bytes32 idInternoHash,
        string calldata motivo,
        bytes32 hashEvento
    ) external onlyRole(ROL_ADMIN) {
        InmateRecord storage ir = _get(idInternoHash);
        if (ir.estadoActual != Estado.INGRESADO)
            revert InvalidaTransicion(ir.estadoActual, Estado.SANCIONADO);
        ir.estadoActual = Estado.SANCIONADO;
        _log(idInternoHash, EventRegistry.TipoEvento.AplicarSancion, motivo, hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.SANCIONADO);
    }

    function cumplirSancion(
        bytes32 idInternoHash,
        string calldata detalle,
        bytes32 hashEvento
    ) external onlyRole(ROL_ADMIN) {
        InmateRecord storage ir = _get(idInternoHash);
        if (ir.estadoActual != Estado.SANCIONADO)
            revert InvalidaTransicion(ir.estadoActual, Estado.INGRESADO);
        ir.estadoActual = Estado.INGRESADO;
        _log(idInternoHash, EventRegistry.TipoEvento.CumplirSancion, detalle, hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.INGRESADO);
    }

    function iniciarPrograma(
        bytes32 idInternoHash,
        string calldata programa,
        bytes32 hashEvento
    ) external onlyRole(ROL_SOCIAL) {
        InmateRecord storage ir = _get(idInternoHash);
        if (ir.estadoActual != Estado.INGRESADO)
            revert InvalidaTransicion(ir.estadoActual, Estado.EN_REHABILITACION);
        ir.estadoActual = Estado.EN_REHABILITACION;
        _log(idInternoHash, EventRegistry.TipoEvento.IniciarPrograma, programa, hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.EN_REHABILITACION);
    }

    function finalizarPrograma(
        bytes32 idInternoHash,
        string calldata resultado,
        bytes32 hashEvento
    ) external onlyRole(ROL_SOCIAL) {
        InmateRecord storage ir = _get(idInternoHash);
        if (ir.estadoActual != Estado.EN_REHABILITACION)
            revert InvalidaTransicion(ir.estadoActual, Estado.INGRESADO);
        ir.estadoActual = Estado.INGRESADO;
        _log(idInternoHash, EventRegistry.TipoEvento.FinalizarPrograma, resultado, hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.INGRESADO);
    }

    function registrarParteMedico(
        bytes32 idInternoHash,
        string calldata informe,
        bytes32 hashEvento
    ) external onlyRole(ROL_MEDICO) {
        InmateRecord storage ir = _get(idInternoHash);
        // No cambia estado, solo auditoría
        _log(idInternoHash, EventRegistry.TipoEvento.ParteMedico, informe, hashEvento);
        emit EstadoActualizado(idInternoHash, ir.estadoActual);
    }


    function liberar(
        bytes32 idInternoHash,
        string calldata resolucion,
        bytes32 hashEvento
    ) external onlyRole(ROL_JUEZ) {
        InmateRecord storage ir = _get(idInternoHash);

        // Ahora: solo desde EN_REHABILITACION
        if (ir.estadoActual != Estado.EN_REHABILITACION) {
            revert InvalidaTransicion(ir.estadoActual, Estado.LIBERADO);
        }

        ir.estadoActual = Estado.LIBERADO;
        _log(idInternoHash, EventRegistry.TipoEvento.Liberacion, resolucion, hashEvento);
        emit EstadoActualizado(idInternoHash, Estado.LIBERADO);
    }


    function setHashExpediente(bytes32 /*idInternoHash*/, bytes32 /*nuevoHash*/)
        external
        pure
    {
        revert("hashExpediente se deriva automaticamente");
    }


    function _get(bytes32 idInternoHash) internal view returns (InmateRecord storage ir) {
        ir = _inmates[idInternoHash];
        if (!ir.existe) revert InternoNoExiste();
    }

    function verInterno(bytes32 idInternoHash) external view returns (InmateRecord memory) {
        return _inmates[idInternoHash];
    }

    function otorgarRol(bytes32 rol, address cuenta) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(rol, cuenta);
    }
}
