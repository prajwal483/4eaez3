import { render } from "@testing-library/react";
import { DecisionChart } from "./DecisionChart";

it("renders without data", () => {
  expect(() => render(<DecisionChart points={[]} />)).not.toThrow();
});
