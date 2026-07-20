from typing import Any

from fastapi import APIRouter, HTTPException

from app.modules.editor_roles.repository import create_role, delete_role, list_roles, update_role
from app.schemas import EditorRolePayload, EditorRoleUpdatePayload

router = APIRouter(tags=["editor-roles"])


@router.get("/editor/roles")
def editor_roles() -> list[dict[str, Any]]:
    return list_roles()


@router.post("/editor/roles", status_code=201)
def add_editor_role(payload: EditorRolePayload) -> dict[str, Any]:
    try:
        return create_role(payload.name, payload.voice, payload.rate)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@router.patch("/editor/roles/{role_id}")
def edit_editor_role(role_id: int, payload: EditorRoleUpdatePayload) -> dict[str, Any]:
    try:
        role = update_role(role_id, payload.name, payload.rate, payload.voice)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if role is None:
        raise HTTPException(404, "角色不存在")
    return role


@router.delete("/editor/roles/{role_id}")
def remove_editor_role(role_id: int) -> dict[str, bool]:
    if not delete_role(role_id):
        raise HTTPException(404, "角色不存在")
    return {"ok": True}
