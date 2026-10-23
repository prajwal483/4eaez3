"""FastAPI dependencies. Tests swap the dataset with app.dependency_overrides[get_dataset]."""

from typing import Annotated

from fastapi import Depends

from app.store import Dataset
from app.store import get_dataset as load_dataset


def get_dataset() -> Dataset:
    return load_dataset()


DatasetDep = Annotated[Dataset, Depends(get_dataset)]
