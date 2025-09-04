"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// CREATE POLL
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  // CSRF validation (double-submit cookie)
  try {
    const { cookies } = await import('next/headers');
    const csrfCookie = (await cookies()).get('csrfToken')?.value;
    const csrfField = formData.get('csrfToken') as string | null;
    if (!csrfCookie || !csrfField || csrfCookie !== csrfField) {
      return { error: 'Invalid CSRF token.' };
    }
  } catch {
    // If headers are unavailable, fail closed
    return { error: 'CSRF validation failed.' };
  }

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  if (!question || options.length < 2) {
    return { error: "Please provide a question and at least two options." };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question,
      options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
export async function getPollById(id: string) {
  const supabase = await createClient();
  // Enforce ownership
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { poll: null, error: 'Not authenticated' };

  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Require login to vote
  if (!user) return { error: 'You must be logged in to vote.' };

  // Validate optionIndex bounds by fetching poll options
  const { data: poll, error: pollErr } = await supabase
    .from('polls')
    .select('options')
    .eq('id', pollId)
    .single();
  if (pollErr) return { error: pollErr.message };
  const options: unknown = poll?.options;
  if (!Array.isArray(options)) return { error: 'Invalid poll options.' };
  if (optionIndex < 0 || optionIndex >= options.length) {
    return { error: 'Invalid option selected.' };
  }

  // Prevent duplicate votes by same user for the same poll
  const { data: existing, error: existingErr } = await supabase
    .from('votes')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingErr && existingErr.code !== 'PGRST116') {
    // Ignore not found code; handle other errors
    return { error: existingErr.message };
  }
  if (existing) {
    return { error: 'You have already voted on this poll.' };
  }

  const { error } = await supabase.from('votes').insert([
    {
      poll_id: pollId,
      user_id: user.id,
      option_index: optionIndex,
    },
  ]);

  if (error) return { error: error.message };
  return { error: null };
}

// DELETE POLL
export async function deletePoll(id: string) {
  const supabase = await createClient();
  // Require auth and ownership check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { error } = await supabase
    .from('polls')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  // CSRF validation (double-submit cookie)
  try {
    const { cookies } = await import('next/headers');
    const csrfCookie = (await cookies()).get('csrfToken')?.value;
    const csrfField = formData.get('csrfToken') as string | null;
    if (!csrfCookie || !csrfField || csrfCookie !== csrfField) {
      return { error: 'Invalid CSRF token.' };
    }
  } catch {
    return { error: 'CSRF validation failed.' };
  }

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  if (!question || options.length < 2) {
    return { error: "Please provide a question and at least two options." };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question, options })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
