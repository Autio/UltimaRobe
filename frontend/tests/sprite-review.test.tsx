import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {SpriteReview} from '@/components/studio/sprite-review';
import type {SpriteJob} from '@/lib/use-sprites';
const job:SpriteJob={job_id:'a'.repeat(32),item_id:'synthetic-item',status:'complete',message:'Ready',candidate:{job_id:'b'.repeat(32),item_id:'synthetic-item',status:'complete',message:'Ready'}};
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('requires acceptance before replacing the current sprite',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true});vi.stubGlobal('fetch',fetch);
 render(<SpriteReview job={job}/>);
 expect(fetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Use new sprite'}));
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({action:'sprite-select',id:'synthetic-item',jobId:'b'.repeat(32),dismiss:false});
});
it('allows keeping the current sprite while regeneration is pending',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}));
 render(<SpriteReview job={{...job,candidate:{...job.candidate!,status:'queued'}}}/>);
 expect(screen.getByRole('button',{name:'Use new sprite'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Keep current sprite'}));
 expect(await screen.findByRole('status')).toHaveTextContent('Kept your current sprite');
});
