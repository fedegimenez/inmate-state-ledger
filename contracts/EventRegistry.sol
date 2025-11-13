// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract EventRegistry is AccessControl {
    bytes32 public constant LEDGER_ROLE = keccak256("LEDGER_ROLE");
    uint256 private _nextId;

    enum TipoEvento {
        Ingreso,
        OrdenDeTraslado,
        ArriboADestino,
        AplicarSancion,
        CumplirSancion,
        IniciarPrograma,
        FinalizarPrograma,
        Liberacion,
        ParteMedico 
    }


    struct Evento {
        uint256 id;
        bytes32 idInternoHash;
        TipoEvento tipo;
        string descripcion;
        uint256 fechaRegistro;
        address rolEmisor;
        bytes32 hashEvento;
        uint8 estadoAsociado;
    }

    mapping(uint256 => Evento) private _eventos;

    event EventoRegistrado(
        uint256 indexed id,
        bytes32 indexed idInternoHash,
        TipoEvento tipo,
        bytes32 hashEvento
    );

    constructor(address ledger) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        if (ledger != address(0)) _grantRole(LEDGER_ROLE, ledger);
        _nextId = 1;
    }

    function grantLedger(address ledger) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(LEDGER_ROLE, ledger);
    }

    function registrar(
        bytes32 idInternoHash,
        TipoEvento tipo,
        string calldata descripcion,
        bytes32 hashEvento,
        uint8 estadoAsociado
    ) external onlyRole(LEDGER_ROLE) returns (uint256 id) {
        id = _nextId++;
        _eventos[id] = Evento({
            id: id,
            idInternoHash: idInternoHash,
            tipo: tipo,
            descripcion: descripcion,
            fechaRegistro: block.timestamp,
            rolEmisor: msg.sender,
            hashEvento: hashEvento,
            estadoAsociado: estadoAsociado
        });
        emit EventoRegistrado(id, idInternoHash, tipo, hashEvento);
    }

    function verEvento(uint256 id) external view returns (Evento memory) {
        return _eventos[id];
    }
}
