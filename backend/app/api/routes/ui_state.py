from fastapi import APIRouter, Depends, Query, status

from app.api.deps import get_ui_state_service
from app.schemas.ui_state import UIStateRead, UIStateUpsert
from app.services.ui_state_service import UIStateService


router = APIRouter()


@router.get("", response_model=list[UIStateRead])
async def list_ui_state(
    user_id: str = Query(..., min_length=1),
    page_key: str | None = Query(default=None),
    service: UIStateService = Depends(get_ui_state_service),
) -> list[UIStateRead]:
    states = await service.list_states(user_id=user_id, page_key=page_key)
    return [UIStateRead.model_validate(state) for state in states]


@router.put("/{component_key}", response_model=UIStateRead, status_code=status.HTTP_200_OK)
async def upsert_ui_state(
    component_key: str,
    payload: UIStateUpsert,
    service: UIStateService = Depends(get_ui_state_service),
) -> UIStateRead:
    if component_key != payload.component_key:
        payload = payload.model_copy(update={"component_key": component_key})
    state = await service.upsert_state(payload)
    return UIStateRead.model_validate(state)

