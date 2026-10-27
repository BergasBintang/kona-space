// A Windows job object that Kona and every program it starts share.
// When Kona closes (or crashes), Windows closes the job, and everything inside it is stopped with it:
// the `claude` programs and any dev server or helper they started. This is what keeps leftovers from piling up.
use std::sync::OnceLock;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

struct Job(HANDLE);
// The handle is only ever used through Windows calls that are safe to make from any thread.
unsafe impl Send for Job {}
unsafe impl Sync for Job {}

static JOB: OnceLock<Option<Job>> = OnceLock::new();

fn job() -> Option<&'static Job> {
    JOB.get_or_init(|| unsafe {
        let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if handle.is_null() {
            return None;
        }
        let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        let ok = SetInformationJobObject(
            handle,
            JobObjectExtendedLimitInformation,
            &mut info as *mut _ as *mut _,
            std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        );
        if ok == 0 {
            CloseHandle(handle);
            return None;
        }
        Some(Job(handle))
    })
    .as_ref()
}

/// Put a running process into the job. Returns false if Windows refused (the program still runs, but is not covered).
pub fn adopt(process: HANDLE) -> bool {
    match job() {
        Some(j) => unsafe { AssignProcessToJobObject(j.0, process) != 0 },
        None => false,
    }
}

/// The ids of every program now inside the job: the `claude` programs and everything they started that is still running.
pub fn member_pids() -> Vec<u32> {
    use windows_sys::Win32::System::JobObjects::{JobObjectBasicProcessIdList, QueryInformationJobObject, JOBOBJECT_BASIC_PROCESS_ID_LIST};
    let Some(j) = job() else { return vec![] };
    // room for 1024 ids; the list starts with two counters
    let mut buf = vec![0usize; 2 + 1024];
    let ok = unsafe { QueryInformationJobObject(j.0, JobObjectBasicProcessIdList, buf.as_mut_ptr() as *mut _, (buf.len() * std::mem::size_of::<usize>()) as u32, std::ptr::null_mut()) };
    if ok == 0 {
        return vec![];
    }
    let list = unsafe { &*(buf.as_ptr() as *const JOBOBJECT_BASIC_PROCESS_ID_LIST) };
    let n = (list.NumberOfProcessIdsInList as usize).min(1024);
    (0..n).map(|i| buf[2 + i] as u32).collect()
}
