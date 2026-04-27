from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AgentRuntimeConfig(BaseModel):
    model: str = Field(min_length=1)
    temperature: float = Field(ge=0.0, le=2.0)
    system_prompt: str = Field(min_length=1)

    @field_validator("system_prompt")
    @classmethod
    def strip_prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("system_prompt cannot be empty")
        return stripped


class JsonConfigField(BaseModel):
    value: dict = Field(default_factory=dict)


class BackendConfig(BaseModel):
    type: str = Field(default="none", min_length=1)
    import_path: str | None = None
    config: dict = Field(default_factory=dict)

    @field_validator("type", mode="before")
    @classmethod
    def strip_type(cls, value: str) -> str:
        stripped = str(value).strip()
        if not stripped:
            raise ValueError("backend.type cannot be empty")
        return stripped

    @field_validator("import_path", mode="before")
    @classmethod
    def strip_import_path(cls, value):
        if value is None:
            return value
        stripped = str(value).strip()
        return stripped or None
