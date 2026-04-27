import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_tool_service
from app.schemas.tool import ToolRead, ToolSourceRead, ToolSourceUpdate, ToolUpdate
from app.services.tool_service import ToolService


router = APIRouter()


@router.get("", response_model=list[ToolRead])
async def list_tools(service: ToolService = Depends(get_tool_service)) -> list[ToolRead]:
    tools = await service.list_tools()
    return [ToolRead.model_validate(tool) for tool in tools]


@router.get("/{tool_id}", response_model=ToolRead)
async def get_tool(
    tool_id: uuid.UUID,
    service: ToolService = Depends(get_tool_service),
) -> ToolRead:
    tool = await service.get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    return ToolRead.model_validate(tool)


@router.patch("/{tool_id}", response_model=ToolRead)
async def update_tool(
    tool_id: uuid.UUID,
    payload: ToolUpdate,
    service: ToolService = Depends(get_tool_service),
) -> ToolRead:
    tool = await service.get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    updated = await service.update_tool(tool, **payload.model_dump(exclude_unset=True))
    return ToolRead.model_validate(updated)


@router.get("/{tool_id}/source", response_model=ToolSourceRead)
async def get_tool_source(
    tool_id: uuid.UUID,
    service: ToolService = Depends(get_tool_service),
) -> ToolSourceRead:
    tool = await service.get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    try:
        source = await service.get_tool_source(tool)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ToolSourceRead.model_validate(source)


@router.put("/{tool_id}/source", response_model=ToolRead)
async def update_tool_source(
    tool_id: uuid.UUID,
    payload: ToolSourceUpdate,
    service: ToolService = Depends(get_tool_service),
) -> ToolRead:
    tool = await service.get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    try:
        updated = await service.update_tool_source(tool, payload.source_code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ToolRead.model_validate(updated)


@router.post("/refresh", response_model=list[ToolRead])
async def refresh_tools(
    service: ToolService = Depends(get_tool_service),
) -> list[ToolRead]:
    tools = await service.refresh_tools()
    return [ToolRead.model_validate(tool) for tool in tools]


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(
    tool_id: uuid.UUID,
    service: ToolService = Depends(get_tool_service),
) -> None:
    tool = await service.get_tool(tool_id)
    if tool is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tool not found")
    await service.delete_tool(tool)
