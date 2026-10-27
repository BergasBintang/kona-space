// What Windows can tell about running programs, without starting PowerShell or any other helper: the list of processes, who started
// whom, when a process was born, its command line, which TCP ports it listens on, and a way to stop it. All the unsafe calls of
// the leftovers feature live here so the rest of the code stays plain.
use std::collections::HashMap;
use windows_sys::Wdk::System::Threading::NtQueryInformationProcess;
use windows_sys::Win32::Foundation::{CloseHandle, FILETIME, HANDLE};
use windows_sys::Win32::NetworkManagement::IpHelper::{GetExtendedTcpTable, MIB_TCP6ROW_OWNER_PID, MIB_TCPROW_OWNER_PID, TCP_TABLE_OWNER_PID_LISTENER};
use windows_sys::Win32::Networking::WinSock::{AF_INET, AF_INET6};
use windows_sys::Win32::System::Diagnostics::Debug::ReadProcessMemory;
use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
use windows_sys::Win32::System::Threading::{GetProcessTimes, OpenProcess, TerminateProcess, PROCESS_BASIC_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE, PROCESS_VM_READ};

pub struct Row {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
}

/// Every running process: its id, its parent's id and its program name.
pub fn snapshot() -> Vec<Row> {
    let mut out = vec![];
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap as isize == -1 || snap.is_null() {
            return out;
        }
        let mut e: PROCESSENTRY32W = std::mem::zeroed();
        e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut ok = Process32FirstW(snap, &mut e);
        while ok != 0 {
            let len = e.szExeFile.iter().position(|&c| c == 0).unwrap_or(e.szExeFile.len());
            out.push(Row { pid: e.th32ProcessID, ppid: e.th32ParentProcessID, name: String::from_utf16_lossy(&e.szExeFile[..len]) });
            ok = Process32NextW(snap, &mut e);
        }
        CloseHandle(snap);
    }
    out
}

fn ft(f: FILETIME) -> u64 {
    ((f.dwHighDateTime as u64) << 32) | f.dwLowDateTime as u64
}

/// When the process was started (Windows file time). With the process id it names one process for good: ids are reused.
pub fn creation_time(pid: u32) -> Option<u64> {
    unsafe {
        let h: HANDLE = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
        if h.is_null() {
            return None;
        }
        let (mut c, mut x, mut k, mut u): (FILETIME, FILETIME, FILETIME, FILETIME) = std::mem::zeroed();
        let ok = GetProcessTimes(h, &mut c, &mut x, &mut k, &mut u);
        CloseHandle(h);
        if ok == 0 { None } else { Some(ft(c)) }
    }
}

fn read<T: Copy>(h: HANDLE, addr: usize) -> Option<T> {
    unsafe {
        let mut v: T = std::mem::zeroed();
        let mut got = 0usize;
        if ReadProcessMemory(h, addr as *const _, &mut v as *mut T as *mut _, std::mem::size_of::<T>(), &mut got) == 0 || got != std::mem::size_of::<T>() {
            return None;
        }
        Some(v)
    }
}

/// The command line a process was started with, read from its own memory (works for 64-bit programs of the same user).
pub fn command_line(pid: u32) -> Option<String> {
    unsafe {
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, 0, pid);
        if h.is_null() {
            return None;
        }
        let result = (|| {
            let mut pbi: PROCESS_BASIC_INFORMATION = std::mem::zeroed();
            let mut len = 0u32;
            if NtQueryInformationProcess(h, 0, &mut pbi as *mut _ as *mut _, std::mem::size_of::<PROCESS_BASIC_INFORMATION>() as u32, &mut len) != 0 || pbi.PebBaseAddress.is_null() {
                return None;
            }
            // PEB.ProcessParameters is at +0x20 and RTL_USER_PROCESS_PARAMETERS.CommandLine (a counted UTF-16 string) at +0x70, on 64-bit Windows
            let params: usize = read(h, pbi.PebBaseAddress as usize + 0x20)?;
            let length: u16 = read(h, params + 0x70)?;
            let buffer: usize = read(h, params + 0x78)?;
            if length == 0 || length > 16_000 || buffer == 0 {
                return None;
            }
            let mut buf = vec![0u16; length as usize / 2];
            let mut got = 0usize;
            if ReadProcessMemory(h, buffer as *const _, buf.as_mut_ptr() as *mut _, length as usize, &mut got) == 0 {
                return None;
            }
            Some(String::from_utf16_lossy(&buf))
        })();
        CloseHandle(h);
        result
    }
}

/// TCP ports that programs are listening on, by process id (IPv4 and IPv6).
pub fn listening_ports() -> HashMap<u32, Vec<u16>> {
    let mut out: HashMap<u32, Vec<u16>> = HashMap::new();
    let port = |p: u32| (((p & 0xFF) << 8) | ((p >> 8) & 0xFF)) as u16;
    unsafe {
        for family in [AF_INET as u32, AF_INET6 as u32] {
            let mut size = 0u32;
            GetExtendedTcpTable(std::ptr::null_mut(), &mut size, 0, family, TCP_TABLE_OWNER_PID_LISTENER, 0);
            if size == 0 {
                continue;
            }
            let mut buf = vec![0u8; size as usize + 1024];
            let mut size = buf.len() as u32;
            if GetExtendedTcpTable(buf.as_mut_ptr() as *mut _, &mut size, 0, family, TCP_TABLE_OWNER_PID_LISTENER, 0) != 0 {
                continue;
            }
            let n = *(buf.as_ptr() as *const u32) as usize;
            let rows = buf.as_ptr().add(4);
            for i in 0..n {
                let (pid, p) = if family == AF_INET as u32 {
                    let r = &*(rows as *const MIB_TCPROW_OWNER_PID).add(i);
                    (r.dwOwningPid, port(r.dwLocalPort))
                } else {
                    let r = &*(rows as *const MIB_TCP6ROW_OWNER_PID).add(i);
                    (r.dwOwningPid, port(r.dwLocalPort))
                };
                let v = out.entry(pid).or_default();
                if !v.contains(&p) {
                    v.push(p);
                }
            }
        }
    }
    for v in out.values_mut() {
        v.sort_unstable();
    }
    out
}

/// Stop one process. The caller has already checked that it is the process the owner agreed to stop.
pub fn terminate(pid: u32) -> bool {
    unsafe {
        let h = OpenProcess(PROCESS_TERMINATE, 0, pid);
        if h.is_null() {
            return false;
        }
        let ok = TerminateProcess(h, 1) != 0;
        CloseHandle(h);
        ok
    }
}
