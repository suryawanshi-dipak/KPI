import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProactiveWorkForm from "../ProactiveWorkForm";
import * as store from "../../lib/store";

vi.mock("../../lib/store", async () => {
  const actual = await vi.importActual("../../lib/store");
  return {
    ...actual,
    listEmployees: vi.fn(),
    listMeasurements: vi.fn(),
  };
});

const CURRENT_USER = { id: 5, name: "Employee Five", role: "employee" };

beforeEach(() => {
  store.listEmployees.mockResolvedValue([{ id: 5, name: "Employee Five", managerId: 2 }]);
  store.listMeasurements.mockResolvedValue([]);
});

/**
 * The shared <Field> component (components/UI.jsx) renders a plain <label> as a sibling of its
 * control — not wrapping it, and without htmlFor/id — so getByLabelText can't resolve it. That's
 * a pre-existing gap in a component used by every form in the app, out of scope to change here.
 * This walks from the label's visible text to the actual input/select/textarea instead.
 */
function fieldControl(labelPattern) {
  const label = screen.getByText(labelPattern);
  return label.closest(".field").querySelector("input, select, textarea");
}

function queryFieldControl(labelPattern) {
  const label = screen.queryByText(labelPattern);
  if (!label) return null;
  return label.closest(".field").querySelector("input, select, textarea");
}

describe("ProactiveWorkForm — Other category rule", () => {
  it("does not show the free-text field until Category = Other", async () => {
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={() => {}} onCancel={() => {}} />);

    expect(queryFieldControl(/what kind of work was it/i)).not.toBeInTheDocument();

    await userEvent.selectOptions(fieldControl(/^category/i), "OTHER");

    await waitFor(() => {
      expect(fieldControl(/what kind of work was it/i)).toBeInTheDocument();
    });
  });

  it("blocks submit with the exact BRD message when Other is picked with blank text", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(fieldControl(/what did you do/i), "Helped a teammate");
    await userEvent.selectOptions(fieldControl(/^category/i), "OTHER");
    await userEvent.type(fieldControl(/^details/i), "Some details here");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    expect(await screen.findByText("Tell us what kind of work this was.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("ProactiveWorkForm — Proactive/Missout type", () => {
  it("defaults to Proactive and submits work_kind accordingly", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    expect(screen.getByLabelText(/^proactive$/i).checked).toBe(true);
    expect(screen.getByLabelText(/^missout$/i).checked).toBe(false);

    await userEvent.type(fieldControl(/what did you do/i), "Covered the on-call rotation");
    await userEvent.selectOptions(fieldControl(/^category/i), "TEAM_SUPPORT");
    await userEvent.type(fieldControl(/^details/i), "Filled in for a sick teammate");
    await userEvent.type(fieldControl(/^impact/i), "Kept the queue from backing up");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].work_kind).toBe("PROACTIVE");
  });

  it("switches to Missout when picked", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText(/^missout$/i));
    expect(screen.getByLabelText(/^missout$/i).checked).toBe(true);
    expect(screen.getByLabelText(/^proactive$/i).checked).toBe(false);

    await userEvent.type(fieldControl(/what did you do/i), "Missed the deployment window");
    // Category options are the Missout-specific set once Type = Missout — EXTRA_HOURS (a
    // Proactive category) is no longer offered.
    await userEvent.selectOptions(fieldControl(/^category/i), "TIMELINE_MISSOUT");
    await userEvent.type(fieldControl(/^details/i), "Release slipped past the SLA");
    await userEvent.type(fieldControl(/^impact/i), "Customer-visible delay of two hours");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].work_kind).toBe("MISSOUT");
    expect(onSubmit.mock.calls[0][0].category).toBe("TIMELINE_MISSOUT");
  });

  it("resets the chosen category when Type changes, since the option lists differ", async () => {
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={() => {}} onCancel={() => {}} />);

    await userEvent.selectOptions(fieldControl(/^category/i), "EXTRA_HOURS");
    expect(fieldControl(/^category/i).value).toBe("EXTRA_HOURS");

    await userEvent.click(screen.getByLabelText(/^missout$/i));
    expect(fieldControl(/^category/i).value).toBe("");

    await userEvent.click(screen.getByLabelText(/^proactive$/i));
    expect(fieldControl(/^category/i).value).toBe("");
  });
});

describe("ProactiveWorkForm — Credit to @mention", () => {
  it("defaults to crediting yourself when nobody is @mentioned", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(fieldControl(/what did you do/i), "Covered the on-call rotation");
    await userEvent.selectOptions(fieldControl(/^category/i), "TEAM_SUPPORT");
    await userEvent.type(fieldControl(/^details/i), "Filled in for a sick teammate");
    await userEvent.type(fieldControl(/^impact/i), "Kept the queue from backing up");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].subject_employee_ids).toEqual([5]);
  });

  it("credits only the @mentioned person, not yourself as well", async () => {
    store.listEmployees.mockResolvedValue([
      { id: 5, name: "Employee Five", managerId: 2 },
      { id: 7, name: "Shreyash Bari", managerId: 2 },
    ]);
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(fieldControl(/what did you do/i), "Covered the on-call rotation");
    await userEvent.selectOptions(fieldControl(/^category/i), "TEAM_SUPPORT");
    await userEvent.type(fieldControl(/^details/i), "Filled in for a sick teammate");
    await userEvent.type(fieldControl(/^impact/i), "Kept the queue from backing up");

    await userEvent.type(fieldControl(/^credit to/i), "@Shreyash");
    const suggestion = await screen.findByRole("button", { name: /shreyash bari/i });
    await userEvent.click(suggestion);

    expect(await screen.findByText("@Shreyash Bari")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    // Mentioning someone else does NOT also pull yourself in — credit is exactly who's mentioned.
    expect(onSubmit.mock.calls[0][0].subject_employee_ids).toEqual([7]);
  });

  it("credits both when you mention yourself alongside someone else", async () => {
    store.listEmployees.mockResolvedValue([
      { id: 5, name: "Employee Five", managerId: 2 },
      { id: 7, name: "Shreyash Bari", managerId: 2 },
    ]);
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(fieldControl(/what did you do/i), "Covered the on-call rotation");
    await userEvent.selectOptions(fieldControl(/^category/i), "TEAM_SUPPORT");
    await userEvent.type(fieldControl(/^details/i), "Filled in for a sick teammate");
    await userEvent.type(fieldControl(/^impact/i), "Kept the queue from backing up");

    await userEvent.type(fieldControl(/^credit to/i), "@Shreyash");
    await userEvent.click(await screen.findByRole("button", { name: /shreyash bari/i }));
    await userEvent.type(fieldControl(/^credit to/i), "@Employee Five");
    await userEvent.click(await screen.findByRole("button", { name: /employee five \(me\)/i }));

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].subject_employee_ids).toEqual([7, 5]);
  });

  it("offers yourself in the mention suggestions, so you can be credited alongside someone else", async () => {
    store.listEmployees.mockResolvedValue([
      { id: 5, name: "Employee Five", managerId: 2 },
      { id: 7, name: "Shreyash Bari", managerId: 2 },
    ]);
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={() => {}} onCancel={() => {}} />);

    await userEvent.type(fieldControl(/^credit to/i), "@e");

    expect(await screen.findByRole("button", { name: /shreyash bari/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /employee five \(me\)/i })).toBeInTheDocument();
  });
});

describe("ProactiveWorkForm — multi-day toggle", () => {
  it("hides Last day until the multi-day box is ticked, and submits start=end when untouched", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    expect(queryFieldControl(/^last day/i)).not.toBeInTheDocument();

    await userEvent.type(fieldControl(/what did you do/i), "Covered the on-call rotation");
    await userEvent.selectOptions(fieldControl(/^category/i), "TEAM_SUPPORT");
    await userEvent.type(fieldControl(/^details/i), "Filled in for a sick teammate");
    await userEvent.type(fieldControl(/^impact/i), "Kept the queue from backing up");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.effort_end_date).toBe(payload.effort_start_date);
  });

  it("reveals Last day once ticked and requires it", async () => {
    const onSubmit = vi.fn();
    render(<ProactiveWorkForm currentUser={CURRENT_USER} onSubmit={onSubmit} onCancel={() => {}} />);

    // Unlike Field's label, the multi-day checkbox itself does have a proper htmlFor/id pair.
    await userEvent.click(screen.getByLabelText(/this ran over several days/i));
    await waitFor(() => {
      expect(fieldControl(/^last day/i)).toBeInTheDocument();
    });

    await userEvent.type(fieldControl(/what did you do/i), "Multi-day effort");
    await userEvent.selectOptions(fieldControl(/^category/i), "EXTRA_HOURS");
    await userEvent.type(fieldControl(/^details/i), "Worked the weekend release");

    fireEvent.click(screen.getByRole("button", { name: /save entry/i }));

    expect(await screen.findByText("Pick the last day.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
